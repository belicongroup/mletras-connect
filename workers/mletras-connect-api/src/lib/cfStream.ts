/**
 * Cloudflare Stream integration.
 *
 * Videos are never buffered or transcoded inside the Worker. Instead the client
 * uploads directly to a one-time Stream upload URL (TUS-capable, resumable).
 * Stream transcodes to adaptive HLS renditions, caps resolution/fps, and
 * generates a poster frame. Delivery and status are read back by uid.
 */
import type { Env } from './env';

const API_BASE = 'https://api.cloudflare.com/client/v4';

export const MAX_VIDEO_DURATION_SECONDS = 180;
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500MB

export function streamEnabled(env: Env): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_STREAM_TOKEN && env.CF_STREAM_CUSTOMER_CODE);
}

export interface StreamDirectUpload {
  uid: string;
  uploadURL: string;
}

/**
 * Requests a one-time direct-creator-upload URL. `maxDurationSeconds` is
 * enforced by Stream during ingest, rejecting overly long videos server-side.
 */
export async function createStreamDirectUpload(
  env: Env,
  creatorId: string,
): Promise<StreamDirectUpload | null> {
  const res = await fetch(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/stream/direct_upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CF_STREAM_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      maxDurationSeconds: MAX_VIDEO_DURATION_SECONDS,
      creator: creatorId,
      requireSignedURLs: false,
    }),
  });

  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; result?: { uid?: string; uploadURL?: string } }
    | null;
  if (!body?.success || !body.result?.uid || !body.result.uploadURL) return null;
  return { uid: body.result.uid, uploadURL: body.result.uploadURL };
}

export interface StreamStatus {
  uid: string;
  ready: boolean;
  state: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}

export async function getStreamVideo(env: Env, uid: string): Promise<StreamStatus | null> {
  const res = await fetch(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/stream/${uid}`, {
    headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` },
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | {
        success?: boolean;
        result?: {
          uid?: string;
          readyToStream?: boolean;
          status?: { state?: string };
          duration?: number;
          input?: { width?: number; height?: number };
        };
      }
    | null;
  if (!body?.success || !body.result?.uid) return null;
  const r = body.result;
  return {
    uid: r.uid as string,
    ready: Boolean(r.readyToStream),
    state: r.status?.state ?? 'unknown',
    durationSeconds: typeof r.duration === 'number' ? r.duration : null,
    width: r.input?.width ?? null,
    height: r.input?.height ?? null,
  };
}

export async function deleteStreamVideo(env: Env, uid: string): Promise<void> {
  await fetch(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/stream/${uid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CF_STREAM_TOKEN}` },
  }).catch(() => undefined);
}

export function streamHlsUrl(env: Env, uid: string): string {
  return `https://customer-${env.CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

export function streamPosterUrl(env: Env, uid: string): string {
  return `https://customer-${env.CF_STREAM_CUSTOMER_CODE}.cloudflarestream.com/${uid}/thumbnails/thumbnail.jpg`;
}

/**
 * Verifies a Stream webhook signature of the form `time=<ts>,sig1=<hex>` where
 * sig1 = HMAC-SHA256(`<ts>.<body>`, secret). Guards against forged callbacks.
 */
export async function verifyStreamWebhook(
  secret: string,
  signatureHeader: string | null,
  rawBody: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  );
  const time = parts.time;
  const sig = parts.sig1;
  if (!time || !sig) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${time}.${rawBody}`),
  );
  const expected = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return timingSafeEqual(expected, sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
