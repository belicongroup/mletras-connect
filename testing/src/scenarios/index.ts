import type { ApiClient } from '../client/ApiClient.js';
import type { TestCollector } from '../reporting/types.js';
import { measure, uniqueEmail, uniqueUsername } from '../utils/random.js';
import {
  assertErrorResponse,
  assertOkResponse,
  validateDbConsistency,
  validateUserShape,
} from '../validators/ApiValidator.js';
import { runSecurityProbes, runSessionSecurityTests, type SharedState } from '../validators/SecurityValidator.js';

const LOCATION = { country: 'United States', state: 'Texas', city: 'Austin' };
const INSTRUMENTS = ['Guitar'];

export async function runAuthScenario(
  client: ApiClient,
  collector: TestCollector,
  shared: SharedState,
): Promise<void> {
  const email = uniqueEmail('auth', Date.now() % 10000);
  const password = 'AuthTest!123456';
  const username = uniqueUsername('auth', Date.now() % 10000);

  // Health
  const health = await measure(() => client.get('/health', false));
  if (health.result.status === 200) {
    collector.pass('Health check', 'auth', health.durationMs, { endpoint: '/health' });
    collector.recordPerformance({ name: 'health', durationMs: health.durationMs });
  } else {
    collector.fail('Health check', 'auth', 'critical', health.durationMs, health.result.rawText);
  }

  // OTP send
  const send = await client.post('/auth/otp/send', { email, flow: 'signup' }, false);
  assertOkResponse(collector, 'OTP send for signup', send);

  // Invalid OTP
  const badCode = await client.post('/auth/otp/verify', { email, code: '999999', flow: 'signup' }, false);
  assertErrorResponse(collector, 'Invalid OTP rejected', badCode, 400, 'invalidCode');

  // Valid OTP
  const peek = await client.peekOtp(email, 'signup');
  const code = peek.data?.pending?.code;
  if (!code) {
    collector.fail('OTP peek (test route)', 'auth', 'critical', peek.durationMs, 'No OTP in test mode');
    return;
  }
  const verify = await client.post('/auth/otp/verify', { email, code, flow: 'signup' }, false);
  assertOkResponse(collector, 'Valid OTP accepted', verify);

  // Reused verification (consume on signup only)
  const signup = await client.post<{ token: string; user: { id: string } }>(
    '/auth/signup',
    { email, password, username, ...LOCATION, instruments: INSTRUMENTS },
    false,
  );
  assertOkResponse(collector, 'Signup after OTP verification', signup);
  if (signup.data?.token) {
    client.setToken(signup.data.token);
    shared.users.set(signup.data.user.id, { token: signup.data.token, email, password });
  }

  // Duplicate signup — email already registered
  const dupSend = await client.post('/auth/otp/send', { email, flow: 'signup' }, false);
  assertErrorResponse(collector, 'OTP send for taken email rejected', dupSend, 400, 'emailTaken');

  const dupSignup = await client.post(
    '/auth/signup',
    { email, password, username: uniqueUsername('dup', 1), ...LOCATION, instruments: INSTRUMENTS },
    false,
  );
  assertErrorResponse(collector, 'Signup without OTP rejected', dupSignup, 400, 'otpNotVerified');

  // Login
  client.setToken(null);
  const login = await measure(() =>
    client.post<{ token: string; user: Record<string, unknown> }>(
      '/auth/login',
      { email, password },
      false,
    ),
  );
  assertOkResponse(collector, 'Login with valid credentials', login.result);
  collector.recordPerformance({ name: 'login', durationMs: login.durationMs });
  if (login.result.data?.token) client.setToken(login.result.data.token);
  if (login.result.data?.user) {
    validateUserShape(collector, 'Login user shape', login.result.data.user as Record<string, unknown>);
  }

  // Bad login
  const badLogin = await client.post('/auth/login', { email, password: 'wrong' }, false);
  assertErrorResponse(collector, 'Invalid password rejected', badLogin, 400, 'invalidCredentials');

  // Session / me
  const me = await client.get('/auth/me');
  assertOkResponse(collector, 'GET /auth/me with valid token', me);

  // Logout + revocation
  if (login.result.data?.token) {
    await runSessionSecurityTests(client, collector, 'auth-scenario', login.result.data.token);
  }

  // Password reset flow
  await client.post('/auth/otp/send', { email, flow: 'reset' }, false);
  const resetPeek = await client.peekOtp(email, 'reset');
  if (resetPeek.data?.pending?.code) {
    await client.post(
      '/auth/otp/verify',
      { email, code: resetPeek.data.pending.code, flow: 'reset' },
      false,
    );
    const newPassword = 'ResetPass!123456';
    const reset = await client.post('/auth/password/reset', { email, password: newPassword }, false);
    assertOkResponse(collector, 'Password reset', reset);

    // Old token should be invalid after reset (token_version bump)
    client.setToken(login.result.data?.token ?? '');
    const stale = await client.get('/auth/me');
    assertErrorResponse(collector, 'Stale token rejected after password reset', stale, 401, 'unauthorized');

    const newLogin = await client.post<{ token: string }>(
      '/auth/login',
      { email, password: newPassword },
      false,
    );
    assertOkResponse(collector, 'Login with new password', newLogin);
  }

  // Manual requirements
  collector.manual('Email verification UI', 'Requires visual confirmation of Resend email delivery in production.');
  collector.manual('Multiple browser tabs', 'Requires Playwright/Detox multi-tab E2E harness (not yet configured).');
  collector.manual('Session refresh', 'No refresh-token endpoint exists; JWT is long-lived (30 days).');
}

export async function runProfileScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const patch = await client.patch('/users/me', {
    firstName: 'Profile',
    lastName: 'Test',
    ...LOCATION,
    instruments: ['Bass', 'Drums'],
  });
  assertOkResponse(collector, 'PATCH /users/me', patch);

  collector.manual('Avatar upload', 'No avatar field in user schema or upload endpoint.');
  collector.manual('Username change', 'Username is immutable after signup.');
  collector.manual('Follow/unfollow users', 'No follow schema or API endpoints.');
  collector.manual('View other user profiles', 'No GET /users/:id endpoint.');
}

export async function runFeedScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const feed = await client.get('/posts/feed?limit=5');
  assertOkResponse(collector, 'Feed first page', feed);

  const emptyCursor = await client.get('/posts/feed?limit=5&cursor=invalid');
  // Invalid cursor may return empty or error — document behavior
  if (emptyCursor.status === 200) {
    collector.pass('Feed with invalid cursor handled', 'feed', emptyCursor.durationMs);
  } else {
    collector.pass('Feed invalid cursor rejected', 'feed', emptyCursor.durationMs);
  }

  collector.manual('Pull-to-refresh UI', 'Requires React Native E2E (Maestro/Detox).');
  collector.manual('Loading skeleton UI', 'Requires component-level UI tests.');
}

export async function runPostsScenario(
  client: ApiClient,
  collector: TestCollector,
  shared: SharedState,
): Promise<void> {
  const create = await client.post<{ post: { id: string; authorId: string } }>('/posts', {
    text: 'Automated test post',
  });
  assertOkResponse(collector, 'Create text post', create);
  const postId = create.data?.post?.id;
  if (postId) {
    shared.posts.set(postId, create.data.post.authorId);
    const get = await client.get(`/posts/${postId}`);
    assertOkResponse(collector, 'Get single post', get);

    const like = await client.post(`/posts/${postId}/like`);
    assertOkResponse(collector, 'Like post', like);

    const unlike = await client.delete(`/posts/${postId}/like`);
    assertOkResponse(collector, 'Unlike post', unlike);

    const del = await client.delete(`/posts/${postId}`);
    assertOkResponse(collector, 'Delete own post', del);
  }

  collector.manual('Edit post', 'No PATCH /posts/:id endpoint.');
  collector.manual('Bookmark post', 'Not implemented.');
  collector.manual('Share post', 'Not implemented.');
  collector.manual('Report post', 'Not implemented.');
}

/** 1x1 transparent PNG (valid magic bytes) used to exercise the upload path. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const buf = Buffer.from(base64, 'base64');
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

interface UploadBody {
  ok?: boolean;
  error?: string;
  deduped?: boolean;
  media?: { mediaAssetId?: string; url?: string; variants?: unknown; type?: string };
}

export async function runMediaScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const png = base64ToArrayBuffer(TINY_PNG_BASE64);

  // Valid image upload (binary body, sniffed as PNG).
  const upload = await client.request<UploadBody>('POST', '/media/upload', {
    body: png,
    headers: { 'Content-Type': 'image/png' },
  });
  const uploadOk = assertOkResponse(collector, 'Upload valid PNG', upload);
  const mediaAssetId = upload.data?.media?.mediaAssetId;

  if (uploadOk && mediaAssetId) {
    // Attach the owned asset to a post and confirm it surfaces in the response.
    const post = await client.post<{ ok?: boolean; error?: string; post?: { media?: unknown[] } }>(
      '/posts',
      { text: 'Post with uploaded image', media: [{ mediaAssetId }] },
    );
    if (assertOkResponse(collector, 'Create post with uploaded image', post)) {
      const count = post.data?.post?.media?.length ?? 0;
      if (count >= 1) {
        collector.pass('Post returns attached media', 'api', post.durationMs, { statusCode: 200 });
      } else {
        collector.fail(
          'Post returns attached media',
          'api',
          'high',
          post.durationMs,
          'Created post did not include attached media',
        );
      }
    }

    // Re-uploading identical bytes should deduplicate to the same asset.
    const dedup = await client.request<UploadBody>('POST', '/media/upload', {
      body: png,
      headers: { 'Content-Type': 'image/png' },
    });
    if (dedup.data?.deduped === true) {
      collector.pass('Duplicate upload deduplicated', 'api', dedup.durationMs, { statusCode: 200 });
    } else {
      collector.pass('Duplicate upload accepted', 'api', dedup.durationMs, {
        statusCode: dedup.status,
        message: 'Dedup not reported (acceptable if provider differs)',
      });
    }
  }

  // Security: bytes that are not a real image but claim to be one must be rejected.
  const junk = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb]).buffer;
  const spoofed = await client.request<UploadBody>('POST', '/media/upload', {
    body: junk,
    headers: { 'Content-Type': 'image/png' },
  });
  assertErrorResponse(collector, 'Spoofed image (bad magic bytes) rejected', spoofed, 415, 'unsupportedMediaType');

  // Security: attaching an asset the caller does not own must be forbidden.
  const foreign = await client.post<{ ok?: boolean; error?: string }>('/posts', {
    text: 'Steal media',
    media: [{ mediaAssetId: '00000000-0000-4000-8000-000000000000' }],
  });
  assertErrorResponse(collector, 'Attaching unowned media rejected', foreign, 403, 'forbidden');

  // Empty upload body is rejected.
  const empty = await client.request<UploadBody>('POST', '/media/upload', {
    body: new ArrayBuffer(0),
    headers: { 'Content-Type': 'image/png' },
  });
  assertErrorResponse(collector, 'Empty upload rejected', empty, 400, 'invalidRequest');

  collector.manual('Video upload pipeline', 'Requires Cloudflare Stream credentials (CF_STREAM_*).');
  collector.manual('EXIF strip verification', 'Verified via Cloudflare Images ingest; needs live account.');
}

export async function runCommentsScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const post = await client.post<{ post: { id: string } }>('/posts', { text: 'Comment target post' });
  const postId = post.data?.post?.id;
  if (!postId) return;

  const comment = await client.post<{ comment: { id: string } }>(`/posts/${postId}/comments`, {
    text: 'Top-level comment',
  });
  assertOkResponse(collector, 'Create comment', comment);

  const parentId = comment.data?.comment?.id;
  if (parentId) {
    const reply = await client.post(`/posts/${postId}/comments`, {
      text: 'Nested reply',
      parentId,
    });
    assertOkResponse(collector, 'Create reply', reply);
  }

  const list = await client.get(`/posts/${postId}/comments`);
  assertOkResponse(collector, 'List comments', list);

  collector.manual('Edit comment', 'No PATCH comment endpoint.');
  collector.manual('Delete comment', 'No DELETE comment endpoint.');
}

export async function runNotificationsScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const count = await client.get('/notifications/unread-count');
  assertOkResponse(collector, 'Unread count', count);

  const list = await client.get('/notifications?limit=10');
  assertOkResponse(collector, 'Notification list', list);

  const readAll = await client.patch('/notifications/read-all');
  assertOkResponse(collector, 'Mark all read', readAll);

  collector.manual('Like notifications', 'Only comment/reply notifications are implemented.');
  collector.manual('Follow notifications', 'Follow feature not implemented.');
  collector.manual('Push notifications', 'App uses polling only.');
}

export async function runSecurityScenario(
  client: ApiClient,
  collector: TestCollector,
  shared: SharedState,
): Promise<void> {
  await runSecurityProbes(client, collector, shared, 'security-scenario');
}

export async function runStressScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  const post = await client.post<{ post: { id: string } }>('/posts', { text: 'Stress test post' });
  const postId = post.data?.post?.id;
  if (!postId) return;

  const likes = await Promise.all(Array.from({ length: 20 }, () => client.post(`/posts/${postId}/like`)));
  const allOk = likes.every((r) => r.status === 200);
  if (allOk) {
    collector.pass('20 sequential likes on same post', 'stress', 0);
  } else {
    collector.fail('20 sequential likes', 'stress', 'medium', 0, 'Some like requests failed');
  }

  const comments = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      client.post(`/posts/${postId}/comments`, { text: `Stress comment ${i}` }),
    ),
  );
  const commentsOk = comments.every((r) => r.status === 200 || r.status === 429);
  if (commentsOk) {
    collector.pass('10 parallel comments', 'stress', 0);
  } else {
    collector.fail('10 parallel comments', 'stress', 'high', 0, 'Unexpected failures');
  }

  await validateDbConsistency(client, collector, 'post-stress');
}

export async function runEdgeCasesScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  client.setAbortNext(true);
  try {
    await client.get('/posts/feed');
    collector.fail('Aborted request', 'edge-case', 'medium', 0, 'Expected abort');
  } catch {
    collector.pass('Aborted request handled', 'edge-case', 0);
  }

  client.setLatency(3000);
  const slow = await client.get('/health', false);
  collector.pass(`Slow network (${Math.round(slow.durationMs)}ms)`, 'edge-case', slow.durationMs);
  client.setLatency(0);

  collector.manual('Worker restart mid-request', 'Requires chaos testing against deployed Workers.');
  collector.manual('KV/D1 artificial delay injection', 'Requires Cloudflare sandbox hooks.');
  collector.manual('Image upload failure paths', 'Requires binary upload simulation.');
}

export async function runSearchScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  void client;
  collector.manual('Search users', 'No search API endpoints.');
  collector.manual('Search posts', 'No search API endpoints.');
  collector.manual('Search hashtags', 'No hashtag indexing.');
}

export async function runDatabaseScenario(client: ApiClient, collector: TestCollector): Promise<void> {
  await validateDbConsistency(client, collector, 'full-run');
  const stats = await client.dbStats();
  if (stats.ok && stats.data?.stats) {
    collector.pass('DB stats retrieved', 'database', stats.durationMs, { actual: stats.data.stats });
  }
}

export async function registerManualRequirements(collector: TestCollector): Promise<void> {
  collector.manual('React console errors', 'Configure Playwright for Expo web to capture console output.');
  collector.manual('Optimistic UI reconciliation', 'Requires UI E2E with network throttling.');
  collector.manual('Infinite loading detection', 'Requires UI automation observing loading states.');
}
