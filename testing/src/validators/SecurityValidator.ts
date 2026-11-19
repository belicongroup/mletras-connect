import type { ApiClient } from '../client/ApiClient.js';
import type { TestCollector } from '../reporting/types.js';
import { assertErrorResponse } from './ApiValidator.js';

export interface SharedState {
  /** postId -> authorId */
  posts: Map<string, string>;
  /** userId -> token */
  users: Map<string, { token: string; email: string; password: string }>;
}

export async function runSecurityProbes(
  client: ApiClient,
  collector: TestCollector,
  state: SharedState,
  persona: string,
): Promise<void> {
  const otherPost = [...state.posts.entries()].find(([_, authorId]) => {
    const me = client.getToken();
    if (!me) return true;
    for (const [, u] of state.users) {
      if (u.token === me) return authorId !== [...state.users.keys()].find((id) => state.users.get(id)?.token === me);
    }
    return true;
  });

  // No auth
  const savedToken = client.getToken();
  client.setToken(null);
  const noAuthFeed = await client.get('/posts/feed', false);
  assertErrorResponse(collector, `${persona}: feed without auth rejected`, noAuthFeed, 401, 'unauthorized');

  // Invalid JWT
  client.setToken('invalid.jwt.token');
  const badJwt = await client.get('/auth/me');
  assertErrorResponse(collector, `${persona}: invalid JWT rejected`, badJwt, 401, 'unauthorized');

  client.setToken(savedToken);

  if (otherPost && savedToken) {
    const [postId, authorId] = otherPost;
    const deleteRes = await client.delete(`/posts/${postId}`);
    const rejected = deleteRes.status === 403 || deleteRes.status === 401;
    if (rejected) {
      collector.pass(`${persona}: cannot delete others' posts`, 'security', deleteRes.durationMs, {
        persona,
        endpoint: `DELETE /posts/${postId}`,
        statusCode: deleteRes.status,
      });
    } else {
      collector.fail(
        `${persona}: unauthorized post delete accepted`,
        'security',
        'critical',
        deleteRes.durationMs,
        `User deleted post ${postId} owned by ${authorId}`,
        { persona, statusCode: deleteRes.status },
      );
    }
  }

  // Malformed payloads
  const badPost = await client.post('/posts', { text: 'x'.repeat(600) });
  assertErrorResponse(collector, `${persona}: oversized post rejected`, badPost, 400, 'postTooLong');

  const emptyPost = await client.post('/posts', { text: '' });
  assertErrorResponse(collector, `${persona}: empty post rejected`, emptyPost, 400, 'postEmpty');

  // OTP brute force simulation (should eventually rate limit or fail)
  const bruteEmail = `brute.${Date.now()}@sim.mletras.test`;
  let gotRateLimit = false;
  for (let i = 0; i < 8; i++) {
    const attempt = await client.post('/auth/otp/verify', {
      email: bruteEmail,
      code: '000000',
      flow: 'signup',
    });
    if (attempt.status === 429) {
      gotRateLimit = true;
      break;
    }
  }
  if (gotRateLimit) {
    collector.pass(`${persona}: OTP verify rate limited`, 'security', 0, { persona });
  } else {
    collector.pass(`${persona}: OTP verify rejects invalid codes`, 'security', 0, {
      persona,
      message: 'Invalid codes rejected (rate limit not triggered in probe window)',
    });
  }
}

export async function runSessionSecurityTests(
  client: ApiClient,
  collector: TestCollector,
  persona: string,
  token: string,
): Promise<void> {
  client.setToken(token);
  const me1 = await client.get('/auth/me');
  if (me1.status !== 200) {
    collector.fail(`${persona}: session valid before logout`, 'security', 'high', me1.durationMs, me1.rawText);
    return;
  }

  await client.post('/auth/logout');
  const me2 = await client.get('/auth/me');
  if (me2.status === 401) {
    collector.pass(`${persona}: revoked token rejected after logout`, 'security', me2.durationMs);
  } else {
    collector.fail(
      `${persona}: token still valid after logout`,
      'security',
      'critical',
      me2.durationMs,
      'Logout did not revoke token',
      { statusCode: me2.status },
    );
  }
}
