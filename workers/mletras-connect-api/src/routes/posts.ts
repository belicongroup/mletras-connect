import { requireAuth, type AuthContext } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import {
  deleteProviderAsset,
  serializePostMedia,
  type MediaProvider,
  type PostMediaRow,
  type SerializedMedia,
} from '../lib/media';
import { streamHlsUrl, streamPosterUrl } from '../lib/cfStream';
import { imageDeliveryUrl } from '../lib/cfImages';
import { enforceRateLimit } from '../lib/rateLimit';

const MAX_TEXT = 500;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_IMAGES_PER_POST = 1;

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

type MediaRow = PostMediaRow;

interface OwnedAsset {
  id: string;
  kind: 'image' | 'video';
  provider: MediaProvider;
  provider_id: string;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  lqip: string | null;
  processing_status: 'ready' | 'pending' | 'failed';
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

function serializePost(row: PostRow, media: SerializedMedia[], isLiked: boolean) {
  // Keep `imageUrl` for older clients: first ready image's medium variant.
  const firstImage = media.find((m) => m.type === 'image');
  return {
    id: row.id,
    authorId: row.author_id,
    text: row.text,
    imageUrl: firstImage?.url,
    media,
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
      `SELECT post_id, type, url, sort_order, provider, provider_id, width, height,
              duration_ms, poster_url, lqip, processing_status
       FROM post_media
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

  const mediaByPost = new Map<string, SerializedMedia[]>();
  for (const m of mediaResult.results ?? []) {
    const list = mediaByPost.get(m.post_id) ?? [];
    list.push(serializePostMedia(env, m));
    mediaByPost.set(m.post_id, list);
  }

  const liked = new Set((likesResult.results ?? []).map((l) => l.post_id));

  return rows.map((row) =>
    serializePost(row, mediaByPost.get(row.id) ?? [], liked.has(row.id)),
  );
}

/**
 * Removes all media files and asset records tied to a post when nothing else
 * references them.
 */
async function cleanupPostMedia(env: Env, postId: string): Promise<void> {
  const media = await env.DB.prepare(
    `SELECT media_asset_id, provider, provider_id, r2_key FROM post_media WHERE post_id = ?`,
  )
    .bind(postId)
    .all<{
      media_asset_id: string | null;
      provider: MediaProvider | null;
      provider_id: string | null;
      r2_key: string | null;
    }>();

  for (const m of media.results ?? []) {
    const key = m.provider_id ?? m.r2_key;
    if (key) {
      const others = await env.DB.prepare(
        `SELECT 1 FROM post_media WHERE (provider_id = ? OR r2_key = ?) AND post_id != ? LIMIT 1`,
      )
        .bind(key, key, postId)
        .first();
      if (!others) {
        await deleteProviderAsset(env, m.provider, m.provider_id, m.r2_key);
      }
    }
    if (m.media_asset_id) {
      const others = await env.DB.prepare(
        `SELECT 1 FROM post_media WHERE media_asset_id = ? AND post_id != ? LIMIT 1`,
      )
        .bind(m.media_asset_id, postId)
        .first();
      if (!others) {
        const asset = await env.DB.prepare(
          `SELECT provider, provider_id FROM media_assets WHERE id = ?`,
        )
          .bind(m.media_asset_id)
          .first<{ provider: MediaProvider; provider_id: string }>();
        if (asset) {
          await deleteProviderAsset(env, asset.provider, asset.provider_id, null);
        }
        await env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(m.media_asset_id).run();
      }
    }
  }
}

/** Permanently removes a post and every related row (comments, likes, media, notifications). */
async function purgePost(env: Env, postId: string, authorId: string): Promise<void> {
  await cleanupPostMedia(env, postId);

  const commentIds = await env.DB.prepare('SELECT id FROM comments WHERE post_id = ?')
    .bind(postId)
    .all<{ id: string }>();
  const ids = (commentIds.results ?? []).map((c) => c.id);

  const statements = [
    env.DB.prepare('DELETE FROM notifications WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM post_likes WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM comments WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM post_media WHERE post_id = ?').bind(postId),
    env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(postId),
    env.DB.prepare('UPDATE users SET posts_count = MAX(posts_count - 1, 0) WHERE id = ?').bind(
      authorId,
    ),
  ];

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(', ');
    statements.unshift(
      env.DB.prepare(
        `DELETE FROM notifications WHERE comment_id IN (${placeholders})`,
      ).bind(...ids),
    );
  }

  await env.DB.batch(statements);
}

/**
 * Resolves client-supplied media references to owner-verified assets.
 *
 * Preferred path: `mediaAssetId` looked up in `media_assets` and checked against
 * the caller. Legacy path: `{ key, url }` accepted only when the key sits under
 * the caller's own `posts/{sub}/` prefix. Enforces per-post media limits.
 */
async function resolveOwnedMedia(
  request: Request,
  env: Env,
  ownerId: string,
  items: Array<{ mediaAssetId?: string; key?: string; url?: string; type?: string }>,
): Promise<OwnedAsset[] | Response> {
  const fail = (error: string): Response =>
    errorResponse(request, error, error === 'forbidden' ? 403 : 400);

  const assetIds = items
    .map((m) => m.mediaAssetId)
    .filter((id): id is string => Boolean(id));

  const ownedById = new Map<string, OwnedAsset>();
  if (assetIds.length > 0) {
    const placeholders = assetIds.map(() => '?').join(', ');
    const result = await env.DB.prepare(
      `SELECT id, kind, provider, provider_id, width, height, duration_ms, lqip, processing_status
       FROM media_assets WHERE owner_id = ? AND id IN (${placeholders})`,
    )
      .bind(ownerId, ...assetIds)
      .all<OwnedAsset>();
    for (const asset of result.results ?? []) ownedById.set(asset.id, asset);
  }

  const resolved: OwnedAsset[] = [];
  for (const item of items) {
    if (item.mediaAssetId) {
      const asset = ownedById.get(item.mediaAssetId);
      if (!asset) return fail('forbidden');
      resolved.push(asset);
      continue;
    }
    // Legacy attach-by-key: only the owner's namespace is allowed.
    if (item.key && item.url && item.type === 'image') {
      if (!item.key.startsWith(`posts/${ownerId}/`)) return fail('forbidden');
      resolved.push({
        id: '',
        kind: 'image',
        provider: 'r2',
        provider_id: item.key,
        width: null,
        height: null,
        duration_ms: null,
        lqip: null,
        processing_status: 'ready',
      });
    }
  }

  const imageCount = resolved.filter((a) => a.kind === 'image').length;
  const videoCount = resolved.filter((a) => a.kind === 'video').length;
  if (imageCount > MAX_IMAGES_PER_POST) return fail('tooManyImages');
  if (videoCount > 1) return fail('tooManyVideos');
  if (videoCount > 0 && imageCount > 0) return fail('mixedMediaUnsupported');

  return resolved;
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
      env.ENABLE_TEST_ROUTES === 'true',
    );
    if (rateLimited) return rateLimited;

    const body = await readJson<{
      text?: string;
      media?: Array<{ mediaAssetId?: string; key?: string; url?: string; type?: string }>;
    }>(request);
    if (!body) return errorResponse(request, 'invalidRequest');

    const text = (body.text ?? '').trim();
    const mediaInput = Array.isArray(body.media) ? body.media : [];

    if (text.length > MAX_TEXT) {
      return errorResponse(request, 'postTooLong');
    }
    if (!text && mediaInput.length === 0) {
      return errorResponse(request, 'postEmpty');
    }

    const resolved = await resolveOwnedMedia(request, env, auth.payload.sub, mediaInput);
    if (resolved instanceof Response) return resolved;

    const postId = crypto.randomUUID();
    const now = new Date().toISOString();
    const origin = env.MEDIA_CDN_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;

    const statements = [
      env.DB.prepare(
        `INSERT INTO posts (id, author_id, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(postId, auth.payload.sub, text, now, now),
      env.DB.prepare('UPDATE users SET posts_count = posts_count + 1 WHERE id = ?').bind(
        auth.payload.sub,
      ),
    ];

    resolved.forEach((asset, index) => {
      const url =
        asset.provider === 'cf_images'
          ? imageDeliveryUrl(env, asset.provider_id, 'medium')
          : asset.provider === 'cf_stream'
            ? streamHlsUrl(env, asset.provider_id)
            : `${origin}/media/${asset.provider_id}`;
      const posterUrl =
        asset.provider === 'cf_stream' ? streamPosterUrl(env, asset.provider_id) : null;
      statements.push(
        env.DB.prepare(
          `INSERT INTO post_media
             (id, post_id, type, r2_key, url, sort_order, created_at,
              media_asset_id, provider, provider_id, width, height, duration_ms,
              poster_url, lqip, processing_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          crypto.randomUUID(),
          postId,
          asset.kind,
          asset.provider_id,
          url,
          index,
          now,
          asset.id || null,
          asset.provider,
          asset.provider_id,
          asset.width,
          asset.height,
          asset.duration_ms,
          posterUrl,
          asset.lqip,
          asset.processing_status,
        ),
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

    const [post] = await hydratePosts(env, [row], auth.payload.sub);
    return jsonResponse(request, { ok: true, post });
  }

  // /posts/:id and /posts/:id/like
  if (path.startsWith('/posts/')) {
    const rest = path.slice('/posts/'.length);
    const [postId, action] = rest.split('/');
    if (!postId) return null;

    if (!action && request.method === 'GET') {
      const auth = await requireAuth(request, env);
      if (auth instanceof Response) return auth;

      const row = await env.DB.prepare(
        `SELECT ${FEED_COLUMNS}
         FROM posts p JOIN users u ON u.id = p.author_id
         WHERE p.id = ? AND p.deleted_at IS NULL`,
      )
        .bind(postId)
        .first<PostRow>();

      if (!row) return errorResponse(request, 'notFound', 404);

      const [post] = await hydratePosts(env, [row], auth.payload.sub);
      return jsonResponse(request, { ok: true, post });
    }

    if (!action && request.method === 'DELETE') {
      const auth = await requireAuth(request, env);
      if (auth instanceof Response) return auth;

      const post = await env.DB.prepare('SELECT author_id FROM posts WHERE id = ?')
        .bind(postId)
        .first<{ author_id: string }>();

      if (!post) return errorResponse(request, 'notFound', 404);
      if (post.author_id !== auth.payload.sub) return errorResponse(request, 'forbidden', 403);

      await purgePost(env, postId, auth.payload.sub);

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
