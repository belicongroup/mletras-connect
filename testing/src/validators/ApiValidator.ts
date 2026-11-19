import type { ApiClient, ApiResponse } from '../client/ApiClient.js';
import type { TestCollector } from '../reporting/types.js';

export function assertOkResponse(
  collector: TestCollector,
  name: string,
  res: ApiResponse<{ ok?: boolean; error?: string }>,
  expectedStatus = 200,
): boolean {
  const data = res.data as { ok?: boolean; error?: string };
  if (res.status !== expectedStatus || data.ok === false) {
    collector.fail(name, 'api', 'high', res.durationMs, `Expected ${expectedStatus} with ok:true`, {
      expected: { status: expectedStatus, ok: true },
      actual: { status: res.status, body: data },
      statusCode: res.status,
    });
    return false;
  }
  collector.pass(name, 'api', res.durationMs, { statusCode: res.status });
  return true;
}

export function assertErrorResponse(
  collector: TestCollector,
  name: string,
  res: ApiResponse<{ ok?: boolean; error?: string }>,
  expectedStatus: number,
  expectedError?: string,
): boolean {
  const data = res.data as { ok?: boolean; error?: string };
  if (res.status !== expectedStatus) {
    collector.fail(name, 'api', 'high', res.durationMs, `Expected status ${expectedStatus}`, {
      expected: expectedStatus,
      actual: res.status,
      statusCode: res.status,
    });
    return false;
  }
  if (data.ok !== false) {
    collector.fail(name, 'api', 'medium', res.durationMs, 'Expected ok:false in error response', {
      actual: data,
      statusCode: res.status,
    });
    return false;
  }
  if (expectedError && data.error !== expectedError) {
    collector.fail(name, 'api', 'medium', res.durationMs, `Expected error code "${expectedError}"`, {
      expected: expectedError,
      actual: data.error,
      statusCode: res.status,
    });
    return false;
  }
  collector.pass(name, 'api', res.durationMs, { statusCode: res.status });
  return true;
}

export function validatePostShape(
  collector: TestCollector,
  name: string,
  post: Record<string, unknown>,
): boolean {
  const required = ['id', 'authorId', 'text', 'createdAt', 'likesCount', 'commentsCount', 'isLiked'];
  const missing = required.filter((k) => !(k in post));
  if (missing.length > 0) {
    collector.fail(name, 'api', 'medium', 0, `Post missing fields: ${missing.join(', ')}`, {
      actual: post,
    });
    return false;
  }
  collector.pass(name, 'api', 0);
  return true;
}

export function validateUserShape(
  collector: TestCollector,
  name: string,
  user: Record<string, unknown>,
): boolean {
  const required = ['id', 'username', 'country', 'state', 'city', 'instruments', 'createdAt'];
  const missing = required.filter((k) => !(k in user));
  if (missing.length > 0) {
    collector.fail(name, 'api', 'medium', 0, `User missing fields: ${missing.join(', ')}`, {
      actual: user,
    });
    return false;
  }
  collector.pass(name, 'api', 0);
  return true;
}

export async function validateDbConsistency(
  client: ApiClient,
  collector: TestCollector,
  label: string,
): Promise<void> {
  const res = await client.dbConsistency();
  if (!res.ok) {
    collector.fail(`${label}: DB consistency check unreachable`, 'database', 'high', res.durationMs, res.rawText);
    return;
  }
  const body = res.data as { issues: Array<{ check: string; severity: string; message: string }> };
  if (body.issues.length === 0) {
    collector.pass(`${label}: DB consistency`, 'database', res.durationMs);
    return;
  }
  for (const issue of body.issues) {
    const sev = (issue.severity as 'critical' | 'high' | 'medium' | 'low') ?? 'high';
    collector.fail(`${label}: ${issue.check}`, 'database', sev, res.durationMs, issue.message, {
      actual: issue,
    });
  }
}
