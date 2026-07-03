import { requireAuth, type AuthContext } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { enforceRateLimit } from '../lib/rateLimit';

const MAX_TEXT = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface PostRow {
  id: string;
  author_id: string;
  text: string;
  created_at: string;
  likes_count: number;
  comments_count: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  country: string;
  state: string;
  city: string;
  instruments: string;
  author_created_at: string;
}

interface MediaRow {
  post_id: string;
  type: string;
  url: string;
  sort_order: number;
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function encodeCursor(createdAt: string, id: string): string {
  return btoa(`${createdAt}|${id}`);
}

function decodeCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const [createdAt, id] = atob(cursor).split('|');
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function serializeAuthor(row: PostRow) {
  return {
    id: row.author_id,
    username: row.username,
    firstName: row.first_name ?? undefined,
    lastName: row.last_name ?? undefined,
    country: row.country,
    state: row.state,
    city: row.city,
    instruments: JSON.parse(row.instruments) as string[],
    createdAt: row.author_created_at,
  };
}

function serializePost(row: PostRow, imageUrl: string | undefined, isLiked: boolean) {
  return {
    id: row.id,
    authorId: row.author_id,
    text: row.text,
    imageUrl,
    createdAt: row.created_at,
    likesCount: row.likes_count,
    commentsCount: row.comments_count,
    isLiked,
    author: serializeAuthor(row),
  };
}

async function hydratePosts(
  env: Env,
  rows: PostRow[],
  viewerId: string,
): Promise<Array<ReturnType<typeof serializePost>>> {
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(', ');

  const [mediaResult, likesResult] = await Promise.all([
    env.DB.prepare(
      `SELECT post_id, type, url, sort_order FROM post_media
       WHERE post_id IN (${placeholders}) ORDER BY sort_order ASC`,
    )
      .bind(...ids)
      .all<MediaRow>(),
    env.DB.prepare(
      `SELECT post_id FROM post_likes
       WHERE user_id = ? AND post_id IN (${placeholders})`,
    )
      .bind(viewerId, ...ids)
      .all<{ post_id: string }>(),
  ]);

  const firstImage = new Map<string, string>();
  for (const m of mediaResult.results ?? []) {
    if (m.type === 'image' && !firstImage.has(m.post_id)) {
      firstImage.set(m.post_id, m.url);
    }
  }

  const liked = new Set((likesResult.results ?? []).map((l) => l.post_id));

  return rows.map((row) => serializePost(row, firstImage.get(row.id), liked.has(row.id)));
}

const FEED_COLUMNS = `
  p.id, p.author_id, p.text, p.created_at, p.likes_count, p.comments_count,
  u.username, u.first_name, u.last_name, u.country, u.state, u.city,
  u.instruments, u.created_at AS author_created_at
`;

async function getFeedPage(
  request: Request,
  env: Env,
  auth: AuthContext,
  authorId?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(Number.parseInt(url.searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const cursorParam = url.searchParams.get('cursor');
  const cursor = cursorParam ? decodeCursor(cursorParam) : null;

  const conditions = ['p.deleted_at IS NULL'];
  const binds: unknown[] = [];
  if (authorId) {
    conditions.push('p.author_id = ?');
    binds.push(authorId);
  }
  if (cursor) {
    conditions.push('(p.created_at < ? OR (p.created_at = ? AND p.id < ?))');
    binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }

  const query = `
    SELECT ${FEED_COLUMNS}
    FROM posts p
    JOIN users u ON u.id = p.author_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ?
  `;

  const result = await env.DB.prepare(query)
    .bind(...binds, limit + 1)
    .all<PostRow>();

  const rows = result.results ?? [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const posts = await hydratePosts(env, pageRows, auth.payload.sub);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

  return jsonResponse(request, { ok: true, posts, nextCursor });
}

export async function handlePostsRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  // GET /posts/feed
  if (path === '/posts/feed' && request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    return getFeedPage(request, env, auth);
  }

  // GET /posts/mine
  if (path === '/posts/mine' && request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;
    return getFeedPage(request, env, auth, auth.payload.sub);
  }

  // POST /posts
  if (path === '/posts' && request.method === 'POST') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const rateLimited = await enforceRateLimit(
      request,
      env.OTP,
      `post:${auth.payload.sub}`,
      20,
      3600,
    );
    if (rateLimited) return rateLimited;

    const body = await readJson<{
      text?: string;
      media?: Array<{ key?: string; url?: string; type?: string }>;
    }>(request);
    if (!body) return errorResponse(request, 'invalidRequest');

    const text = (body.text ?? '').trim();
    const media = Array.isArray(body.media) ? body.media : [];

    if (text.length > MAX_TEXT) {
      return errorResponse(request, 'postTooLong');
    }
    if (!text && media.length === 0) {
      return errorResponse(request, 'postEmpty');
    }

    const validMedia = media.filter(
      (m): m is { key: string; url: string; type: string } =>
        Boolean(m.key && m.url && m.type === 'image'),
    );

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();

    const statements = [
      env.DB.prepare(
        `INSERT INTO posts (id, author_id, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(postId, auth.payload.sub, text, now, now),
      env.DB.prepare('UPDATE users SET posts_count = posts_count + 1 WHERE id = ?').bind(
        auth.payload.sub,
      ),
    ];

    validMedia.forEach((m, index) => {
      statements.push(
        env.DB.prepare(
          `INSERT INTO post_media (id, post_id, type, r2_key, url, sort_order, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), postId, 'image', m.key, m.url, index, now),
      );
    });

    await env.DB.batch(statements);

    const row = await env.DB.prepare(
      `SELECT ${FEED_COLUMNS}
       FROM posts p JOIN users u ON u.id = p.author_id
       WHERE p.id = ?`,
    )
      .bind(postId)
      .first<PostRow>();

    if (!row) return errorResponse(request, 'unknown', 500);

    const imageUrl = validMedia[0]?.url;
    return jsonResponse(request, {
      ok: true,
      post: serializePost(row, imageUrl, false),
    });
  }

  // /posts/:id and /posts/:id/like
  if (path.startsWith('/posts/')) {
    const rest = path.slice('/posts/'.length);
    const [postId, action] = rest.split('/');
    if (!postId) return null;

    if (!action && request.method === 'DELETE') {
      const auth = await requireAuth(request, env);
      if (auth instanceof Response) return auth;

      const post = await env.DB.prepare(
        'SELECT author_id, deleted_at FROM posts WHERE id = ?',
      )
        .bind(postId)
        .first<{ author_id: string; deleted_at: string | null }>();

      if (!post || post.deleted_at) return errorResponse(request, 'notFound', 404);
      if (post.author_id !== auth.payload.sub) return errorResponse(request, 'forbidden', 403);

      await env.DB.batch([
        env.DB.prepare('UPDATE posts SET deleted_at = ? WHERE id = ?').bind(
          new Date().toISOString(),
          postId,
        ),
        env.DB.prepare(
          'UPDATE users SET posts_count = MAX(posts_count - 1, 0) WHERE id = ?',
        ).bind(auth.payload.sub),
      ]);

      return jsonResponse(request, { ok: true });
    }

    if (action === 'like' && request.method === 'POST') {
      const auth = await requireAuth(request, env);
      if (auth instanceof Response) return auth;

      const exists = await env.DB.prepare(
        'SELECT id FROM posts WHERE id = ? AND deleted_at IS NULL',
      )
        .bind(postId)
        .first();
      if (!exists) return errorResponse(request, 'notFound', 404);

      const insert = await env.DB.prepare(
        `INSERT OR IGNORE INTO post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)`,
      )
        .bind(postId, auth.payload.sub, new Date().toISOString())
        .run();

      if (insert.meta.changes > 0) {
        await env.DB.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?')
          .bind(postId)
          .run();
      }

      const row = await env.DB.prepare('SELECT likes_count FROM posts WHERE id = ?')
        .bind(postId)
        .first<{ likes_count: number }>();

      return jsonResponse(request, { ok: true, likesCount: row?.likes_count ?? 0, isLiked: true });
    }

    if (action === 'like' && request.method === 'DELETE') {
      const auth = await requireAuth(request, env);
      if (auth instanceof Response) return auth;

      const del = await env.DB.prepare(
        'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?',
      )
        .bind(postId, auth.payload.sub)
        .run();

      if (del.meta.changes > 0) {
        await env.DB.prepare(
          'UPDATE posts SET likes_count = MAX(likes_count - 1, 0) WHERE id = ?',
        )
          .bind(postId)
          .run();
      }

      const row = await env.DB.prepare('SELECT likes_count FROM posts WHERE id = ?')
        .bind(postId)
        .first<{ likes_count: number }>();

      return jsonResponse(request, { ok: true, likesCount: row?.likes_count ?? 0, isLiked: false });
    }
  }

  return null;
}
