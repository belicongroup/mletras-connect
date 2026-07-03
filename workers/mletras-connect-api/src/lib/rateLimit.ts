import { errorResponse } from './cors';

export function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

/**
 * Fixed-window counter backed by KV. Not perfectly atomic (KV is eventually
 * consistent) but sufficient as basic abuse throttling for auth endpoints.
 * Returns true when the request is allowed, false when the limit is exceeded.
 */
export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const bucketKey = `rl:${key}`;
  const raw = await kv.get(bucketKey);
  const count = raw ? Number.parseInt(raw, 10) : 0;

  if (count >= limit) {
    return false;
  }

  await kv.put(bucketKey, String(count + 1), { expirationTtl: windowSeconds });
  return true;
}

/**
 * Convenience helper: returns a 429 Response when rate limited, otherwise null.
 */
export async function enforceRateLimit(
  request: Request,
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const allowed = await checkRateLimit(kv, key, limit, windowSeconds);
  if (allowed) return null;
  return errorResponse(request, 'tooManyRequests', 429);
}
