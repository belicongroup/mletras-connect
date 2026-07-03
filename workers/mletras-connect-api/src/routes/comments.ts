import { requireAuth } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { enforceRateLimit } from '../lib/rateLimit';

const MAX_TEXT = 1000;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  text: string;
  created_at: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  country: string;
  state: string;
  city: string;
  instruments: string;
  author_created_at: string;
}

const COMMENT_COLUMNS = `
  c.id, c.post_id, c.author_id, c.parent_id, c.text, c.created_at,
  u.username, u.first_name, u.last_name, u.country, u.state, u.city,
  u.instruments, u.created_at AS author_created_at
`;

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

function serializeComment(row: CommentRow) {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    text: row.text,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      username: row.username,
      firstName: row.first_name ?? undefined,
      lastName: row.last_name ?? undefined,
      country: row.country,
      state: row.state,
      city: row.city,
      instruments: JSON.parse(row.instruments) as string[],
      createdAt: row.author_created_at,
    },
  };
}

export async function handleCommentsRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  // Match /posts/:id/comments
  const match = path.match(/^\/posts\/([^/]+)\/comments$/);
  if (!match) return null;
  const postId = match[1];

  if (request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const cursorParam = url.searchParams.get('cursor');
    const cursor = cursorParam ? decodeCursor(cursorParam) : null;

    const conditions = ['c.post_id = ?', 'c.parent_id IS NULL', 'c.deleted_at IS NULL'];
    const binds: unknown[] = [postId];
    if (cursor) {
      conditions.push('(c.created_at > ? OR (c.created_at = ? AND c.id > ?))');
      binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }

    const topResult = await env.DB.prepare(
      `SELECT ${COMMENT_COLUMNS}
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT ?`,
    )
      .bind(...binds, limit + 1)
      .all<CommentRow>();

    const topRows = topResult.results ?? [];
    const hasMore = topRows.length > limit;
    const pageRows = hasMore ? topRows.slice(0, limit) : topRows;

    // Fetch replies for the returned top-level comments in one query.
    let repliesByParent = new Map<string, ReturnType<typeof serializeComment>[]>();
    if (pageRows.length > 0) {
      const parentIds = pageRows.map((r) => r.id);
      const placeholders = parentIds.map(() => '?').join(', ');
      const replyResult = await env.DB.prepare(
        `SELECT ${COMMENT_COLUMNS}
         FROM comments c JOIN users u ON u.id = c.author_id
         WHERE c.parent_id IN (${placeholders}) AND c.deleted_at IS NULL
         ORDER BY c.created_at ASC, c.id ASC`,
      )
        .bind(...parentIds)
        .all<CommentRow>();

      for (const row of replyResult.results ?? []) {
        const list = repliesByParent.get(row.parent_id!) ?? [];
        list.push(serializeComment(row));
        repliesByParent.set(row.parent_id!, list);
      }
    }

    const comments = pageRows.map((row) => ({
      ...serializeComment(row),
      replies: repliesByParent.get(row.id) ?? [],
    }));

    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

    return jsonResponse(request, { ok: true, comments, nextCursor });
  }

  if (request.method === 'POST') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const rateLimited = await enforceRateLimit(
      request,
      env.OTP,
      `comment:${auth.payload.sub}`,
      30,
      3600,
    );
    if (rateLimited) return rateLimited;

    const post = await env.DB.prepare(
      'SELECT author_id, deleted_at FROM posts WHERE id = ?',
    )
      .bind(postId)
      .first<{ author_id: string; deleted_at: string | null }>();
    if (!post || post.deleted_at) return errorResponse(request, 'notFound', 404);

    const body = await readJson<{ text?: string; parentId?: string }>(request);
    const text = (body?.text ?? '').trim();
    if (!text) return errorResponse(request, 'commentEmpty');
    if (text.length > MAX_TEXT) return errorResponse(request, 'commentTooLong');

    let parentId: string | null = null;
    if (body?.parentId) {
      // Enforce max depth of 2: parent must be a top-level comment on this post.
      const parent = await env.DB.prepare(
        'SELECT id, parent_id FROM comments WHERE id = ? AND post_id = ? AND deleted_at IS NULL',
      )
        .bind(body.parentId, postId)
        .first<{ id: string; parent_id: string | null }>();
      if (!parent) return errorResponse(request, 'notFound', 404);
      // If replying to a reply, attach to its top-level parent instead.
      parentId = parent.parent_id ?? parent.id;
    }

    const actorId = auth.payload.sub;
    const commentId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Gather notification recipients before writing.
    const priorCommenters = await env.DB.prepare(
      `SELECT DISTINCT author_id FROM comments
       WHERE post_id = ? AND author_id != ? AND author_id != ? AND deleted_at IS NULL`,
    )
      .bind(postId, actorId, post.author_id)
      .all<{ author_id: string }>();

    const statements = [
      env.DB.prepare(
        `INSERT INTO comments (id, post_id, author_id, parent_id, text, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(commentId, postId, actorId, parentId, text, now, now),
      env.DB.prepare(
        'UPDATE posts SET comments_count = comments_count + 1 WHERE id = ?',
      ).bind(postId),
    ];

    // Post author gets a comment_on_post notification (unless they are the actor).
    if (post.author_id !== actorId) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, actor_id, type, post_id, comment_id, created_at)
           VALUES (?, ?, ?, 'comment_on_post', ?, ?, ?)`,
        ).bind(crypto.randomUUID(), post.author_id, actorId, postId, commentId, now),
      );
    }

    // Other prior participants get a reply_in_thread notification.
    for (const row of priorCommenters.results ?? []) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, actor_id, type, post_id, comment_id, created_at)
           VALUES (?, ?, ?, 'reply_in_thread', ?, ?, ?)`,
        ).bind(crypto.randomUUID(), row.author_id, actorId, postId, commentId, now),
      );
    }

    await env.DB.batch(statements);

    const row = await env.DB.prepare(
      `SELECT ${COMMENT_COLUMNS}
       FROM comments c JOIN users u ON u.id = c.author_id
       WHERE c.id = ?`,
    )
      .bind(commentId)
      .first<CommentRow>();

    if (!row) return errorResponse(request, 'unknown', 500);

    return jsonResponse(request, {
      ok: true,
      comment: { ...serializeComment(row), replies: [] },
    });
  }

  return null;
}
