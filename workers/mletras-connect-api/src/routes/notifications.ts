import { requireAuth } from '../lib/auth';
import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

interface NotificationRow {
  id: string;
  type: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  actor_id: string;
  actor_username: string;
  actor_first_name: string | null;
  actor_last_name: string | null;
  post_text: string | null;
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

function preview(text: string | null): string | undefined {
  if (!text) return undefined;
  const trimmed = text.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
}

function serialize(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    postId: row.post_id ?? undefined,
    commentId: row.comment_id ?? undefined,
    read: row.read_at !== null,
    createdAt: row.created_at,
    actor: {
      id: row.actor_id,
      username: row.actor_username,
      firstName: row.actor_first_name ?? undefined,
      lastName: row.actor_last_name ?? undefined,
    },
    postPreview: preview(row.post_text),
  };
}

export async function handleNotificationsRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (path === '/notifications/unread-count' && request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    )
      .bind(auth.payload.sub)
      .first<{ count: number }>();

    return jsonResponse(request, { ok: true, count: row?.count ?? 0 });
  }

  if (path === '/notifications/read-all' && request.method === 'PATCH') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    await env.DB.prepare(
      'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
    )
      .bind(new Date().toISOString(), auth.payload.sub)
      .run();

    return jsonResponse(request, { ok: true });
  }

  const readMatch = path.match(/^\/notifications\/([^/]+)\/read$/);
  if (readMatch && request.method === 'PATCH') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    await env.DB.prepare(
      'UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL',
    )
      .bind(new Date().toISOString(), readMatch[1], auth.payload.sub)
      .run();

    return jsonResponse(request, { ok: true });
  }

  if (path === '/notifications' && request.method === 'GET') {
    const auth = await requireAuth(request, env);
    if (auth instanceof Response) return auth;

    const url = new URL(request.url);
    const limit = Math.min(
      Math.max(Number.parseInt(url.searchParams.get('limit') ?? '', 10) || DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const cursorParam = url.searchParams.get('cursor');
    const cursor = cursorParam ? decodeCursor(cursorParam) : null;

    const conditions = ['n.user_id = ?'];
    const binds: unknown[] = [auth.payload.sub];
    if (cursor) {
      conditions.push('(n.created_at < ? OR (n.created_at = ? AND n.id < ?))');
      binds.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }

    const result = await env.DB.prepare(
      `SELECT
        n.id, n.type, n.post_id, n.comment_id, n.read_at, n.created_at, n.actor_id,
        a.username AS actor_username, a.first_name AS actor_first_name,
        a.last_name AS actor_last_name, p.text AS post_text
       FROM notifications n
       JOIN users a ON a.id = n.actor_id
       LEFT JOIN posts p ON p.id = n.post_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY n.created_at DESC, n.id DESC
       LIMIT ?`,
    )
      .bind(...binds, limit + 1)
      .all<NotificationRow>();

    const rows = result.results ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    const notifications = pageRows.map(serialize);
    const last = pageRows[pageRows.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(last.created_at, last.id) : null;

    return jsonResponse(request, { ok: true, notifications, nextCursor });
  }

  return null;
}
