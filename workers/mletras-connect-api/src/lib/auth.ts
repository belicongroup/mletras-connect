import { errorResponse } from './cors';
import type { Env } from './env';
import { getBearerToken, verifyToken, type JwtPayload } from './jwt';

export interface AuthContext {
  token: string;
  payload: JwtPayload;
}

function tokenSignature(token: string): string {
  const parts = token.split('.');
  return parts[2] ?? token;
}

function revokedKey(token: string): string {
  return `revoked:${tokenSignature(token)}`;
}

export async function isTokenRevoked(kv: KVNamespace, token: string): Promise<boolean> {
  const value = await kv.get(revokedKey(token));
  return value !== null;
}

export async function revokeToken(
  kv: KVNamespace,
  token: string,
  exp: number,
): Promise<void> {
  const ttl = exp - Math.floor(Date.now() / 1000);
  if (ttl <= 0) return;
  await kv.put(revokedKey(token), '1', { expirationTtl: ttl });
}

/**
 * Validates the bearer token: signature, expiry, and revocation denylist.
 * Returns an AuthContext on success or a 401 Response on failure.
 * Token-version (per-user global invalidation) is checked by the caller once
 * the user row is loaded, since it requires a DB lookup.
 */
export async function requireAuth(
  request: Request,
  env: Env,
): Promise<AuthContext | Response> {
  const token = getBearerToken(request);
  if (!token) {
    return errorResponse(request, 'unauthorized', 401);
  }

  const payload = await verifyToken(token, env.JWT_SECRET);
  if (!payload) {
    return errorResponse(request, 'unauthorized', 401);
  }

  if (await isTokenRevoked(env.OTP, token)) {
    return errorResponse(request, 'unauthorized', 401);
  }

  return { token, payload };
}
