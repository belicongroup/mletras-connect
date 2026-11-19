import { errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import { peekOtp, peekVerified, type OtpFlow } from '../lib/otp';

function isTestMode(env: Env): boolean {
  return env.ENABLE_TEST_ROUTES === 'true';
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

interface ConsistencyIssue {
  check: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  details?: unknown;
}

async function runDbConsistencyChecks(env: Env): Promise<ConsistencyIssue[]> {
  const issues: ConsistencyIssue[] = [];

  const orphanMedia = await env.DB.prepare(
    `SELECT pm.id, pm.post_id FROM post_media pm
     LEFT JOIN posts p ON p.id = pm.post_id
     WHERE p.id IS NULL`,
  ).all<{ id: string; post_id: string }>();
  if ((orphanMedia.results?.length ?? 0) > 0) {
    issues.push({
      check: 'orphan_post_media',
      severity: 'high',
      message: 'post_media rows reference missing posts',
      details: orphanMedia.results,
    });
  }

  const orphanLikes = await env.DB.prepare(
    `SELECT pl.post_id, pl.user_id FROM post_likes pl
     LEFT JOIN posts p ON p.id = pl.post_id
     WHERE p.id IS NULL OR p.deleted_at IS NOT NULL`,
  ).all<{ post_id: string; user_id: string }>();
  if ((orphanLikes.results?.length ?? 0) > 0) {
    issues.push({
      check: 'orphan_post_likes',
      severity: 'high',
      message: 'post_likes reference deleted or missing posts',
      details: orphanLikes.results,
    });
  }

  const orphanComments = await env.DB.prepare(
    `SELECT c.id, c.post_id FROM comments c
     LEFT JOIN posts p ON p.id = c.post_id
     WHERE p.id IS NULL`,
  ).all<{ id: string; post_id: string }>();
  if ((orphanComments.results?.length ?? 0) > 0) {
    issues.push({
      check: 'orphan_comments',
      severity: 'high',
      message: 'comments reference missing posts',
      details: orphanComments.results,
    });
  }

  const likeCountMismatch = await env.DB.prepare(
    `SELECT p.id, p.likes_count AS stored,
            (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS actual
     FROM posts p
     WHERE p.deleted_at IS NULL
       AND p.likes_count != (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id)`,
  ).all<{ id: string; stored: number; actual: number }>();
  if ((likeCountMismatch.results?.length ?? 0) > 0) {
    issues.push({
      check: 'likes_count_mismatch',
      severity: 'critical',
      message: 'posts.likes_count does not match post_likes row count',
      details: likeCountMismatch.results,
    });
  }

  const commentCountMismatch = await env.DB.prepare(
    `SELECT p.id, p.comments_count AS stored,
            (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS actual
     FROM posts p
     WHERE p.deleted_at IS NULL
       AND p.comments_count != (
         SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL
       )`,
  ).all<{ id: string; stored: number; actual: number }>();
  if ((commentCountMismatch.results?.length ?? 0) > 0) {
    issues.push({
      check: 'comments_count_mismatch',
      severity: 'critical',
      message: 'posts.comments_count does not match active comments',
      details: commentCountMismatch.results,
    });
  }

  const postsCountMismatch = await env.DB.prepare(
    `SELECT u.id, u.posts_count AS stored,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.deleted_at IS NULL) AS actual
     FROM users u
     WHERE u.posts_count != (
       SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.deleted_at IS NULL
     )`,
  ).all<{ id: string; stored: number; actual: number }>();
  if ((postsCountMismatch.results?.length ?? 0) > 0) {
    issues.push({
      check: 'user_posts_count_mismatch',
      severity: 'high',
      message: 'users.posts_count does not match active posts',
      details: postsCountMismatch.results,
    });
  }

  const duplicateLikes = await env.DB.prepare(
    `SELECT post_id, user_id, COUNT(*) AS cnt
     FROM post_likes GROUP BY post_id, user_id HAVING cnt > 1`,
  ).all<{ post_id: string; user_id: string; cnt: number }>();
  if ((duplicateLikes.results?.length ?? 0) > 0) {
    issues.push({
      check: 'duplicate_post_likes',
      severity: 'critical',
      message: 'duplicate post_likes primary keys detected',
      details: duplicateLikes.results,
    });
  }

  const invalidFkComments = await env.DB.prepare(
    `SELECT c.id FROM comments c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE u.id IS NULL`,
  ).all<{ id: string }>();
  if ((invalidFkComments.results?.length ?? 0) > 0) {
    issues.push({
      check: 'comments_invalid_author',
      severity: 'critical',
      message: 'comments reference missing users',
      details: invalidFkComments.results,
    });
  }

  const invalidFkNotifications = await env.DB.prepare(
    `SELECT n.id FROM notifications n
     LEFT JOIN users u ON u.id = n.user_id
     WHERE u.id IS NULL`,
  ).all<{ id: string }>();
  if ((invalidFkNotifications.results?.length ?? 0) > 0) {
    issues.push({
      check: 'notifications_invalid_user',
      severity: 'high',
      message: 'notifications reference missing users',
      details: invalidFkNotifications.results,
    });
  }

  return issues;
}

export async function handleTestRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (!path.startsWith('/__test__')) return null;
  if (!isTestMode(env)) {
    return errorResponse(request, 'notFound', 404);
  }

  if (path === '/__test__/health' && request.method === 'GET') {
    return jsonResponse(request, { ok: true, testMode: true });
  }

  if (path === '/__test__/otp/peek' && request.method === 'GET') {
    const url = new URL(request.url);
    const email = url.searchParams.get('email')?.trim().toLowerCase() ?? '';
    const flow: OtpFlow = url.searchParams.get('flow') === 'reset' ? 'reset' : 'signup';
    if (!email) return errorResponse(request, 'invalidRequest');

    const pending = await peekOtp(env.OTP, flow, email);
    const verified = await peekVerified(env.OTP, flow, email);
    return jsonResponse(request, { ok: true, pending, verified });
  }

  if (path === '/__test__/rate-limit/clear' && request.method === 'POST') {
    const body = await readJson<{ prefix?: string }>(request);
    const prefix = body?.prefix ?? 'rl:';
    // KV list is not available in all contexts; clear known test prefixes via delete.
    // Callers pass explicit keys when needed.
    const keys = (body as { keys?: string[] })?.keys ?? [];
    await Promise.all(keys.map((key) => env.OTP.delete(key.startsWith('rl:') ? key : `rl:${key}`)));
    return jsonResponse(request, { ok: true, cleared: keys.length, prefix });
  }

  if (path === '/__test__/db/consistency' && request.method === 'GET') {
    const issues = await runDbConsistencyChecks(env);
    return jsonResponse(request, { ok: true, issues, issueCount: issues.length });
  }

  if (path === '/__test__/db/stats' && request.method === 'GET') {
    const [users, posts, comments, likes, notifications] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS c FROM users').first<{ c: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM posts WHERE deleted_at IS NULL').first<{ c: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM comments WHERE deleted_at IS NULL').first<{ c: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM post_likes').first<{ c: number }>(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM notifications').first<{ c: number }>(),
    ]);
    return jsonResponse(request, {
      ok: true,
      stats: {
        users: users?.c ?? 0,
        posts: posts?.c ?? 0,
        comments: comments?.c ?? 0,
        likes: likes?.c ?? 0,
        notifications: notifications?.c ?? 0,
      },
    });
  }

  return errorResponse(request, 'notFound', 404);
}
