import { requireAuth } from '../lib/auth';
import {
  imageDeliveryUrl,
  imagesEnabled,
  uploadToCloudflareImages,
} from '../lib/cfImages';
import {
  createStreamDirectUpload,
  streamEnabled,
  streamHlsUrl,
  streamPosterUrl,
  verifyStreamWebhook,
} from '../lib/cfStream';
import { corsHeaders, errorResponse, jsonResponse } from '../lib/cors';
import type { Env } from '../lib/env';
import {
  serializePostMedia,
  type MediaProvider,
  type PostMediaRow,
  type ProcessingStatus,
} from '../lib/media';
import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  readImageDimensions,
  sha256Hex,
  sniffImage,
} from '../lib/mediaValidation';
import { enforceRateLimit } from '../lib/rateLimit';

const IMAGE_UPLOADS_PER_HOUR = 60;
const VIDEO_UPLOADS_PER_HOUR = 10;

function publicUrl(request: Request, env: Env, key: string): string {
  const origin = env.MEDIA_CDN_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
  return `${origin}/media/${key}`;
}

/** Rejects keys that could escape the media namespace via traversal or absolutes. */
function isSafeR2Key(key: string): boolean {
  return key.length > 0 && !key.includes('..') && !key.startsWith('/');
}

interface MediaAssetInsert {
  id: string;
  ownerId: string;
  kind: 'image' | 'video';
  provider: MediaProvider;
  providerId: string;
  contentHash: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  bytes: number | null;
  lqip: string | null;
  status: 'ready' | 'pending' | 'failed';
}

async function insertMediaAsset(env: Env, a: MediaAssetInsert): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO media_assets
       (id, owner_id, kind, provider, provider_id, content_hash, width, height,
        duration_ms, bytes, lqip, processing_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      a.id,
      a.ownerId,
      a.kind,
      a.provider,
      a.providerId,
      a.contentHash,
      a.width,
      a.height,
      a.durationMs,
      a.bytes,
      a.lqip,
      a.status,
      new Date().toISOString(),
    )
    .run();
}

/**
 * Propagates a Stream asset's processing result to BOTH the canonical
 * `media_assets` row and every `post_media` row that already references it.
 *
 * Posts are usually created while the video is still transcoding, so their
 * `post_media` snapshot starts as `pending`. Without this second update the
 * feed (which reads status/dimensions from `post_media`) would stay stuck on
 * "Processing" forever even after Stream finishes. Both writes run in one batch
 * so the two tables never diverge.
 */
async function syncStreamStatus(
  env: Env,
  uid: string,
  fields: {
    status: ProcessingStatus;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  },
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE media_assets SET processing_status = ?, width = ?, height = ?, duration_ms = ?
       WHERE provider = 'cf_stream' AND provider_id = ?`,
    ).bind(fields.status, fields.width, fields.height, fields.durationMs, uid),
    env.DB.prepare(
      `UPDATE post_media SET processing_status = ?, width = ?, height = ?, duration_ms = ?
       WHERE provider = 'cf_stream' AND provider_id = ?`,
    ).bind(fields.status, fields.width, fields.height, fields.durationMs, uid),
  ]);
}

/** Serializes a media_assets row into the upload response the client attaches. */
function assetResponse(
  env: Env,
  row: {
    id: string;
    kind: string;
    provider: MediaProvider;
    provider_id: string;
    width: number | null;
    height: number | null;
    duration_ms: number | null;
    lqip: string | null;
    processing_status: string;
  },
  r2Url = '',
) {
  const media = serializePostMedia(env, {
    post_id: '',
    type: row.kind,
    url:
      row.provider === 'cf_images'
        ? imageDeliveryUrl(env, row.provider_id, 'medium')
        : row.provider === 'cf_stream'
          ? streamHlsUrl(env, row.provider_id)
          : r2Url,
    sort_order: 0,
    provider: row.provider,
    provider_id: row.provider_id,
    width: row.width,
    height: row.height,
    duration_ms: row.duration_ms,
    poster_url: row.provider === 'cf_stream' ? streamPosterUrl(env, row.provider_id) : null,
    lqip: row.lqip,
    processing_status: row.processing_status as PostMediaRow['processing_status'],
  });
  return { mediaAssetId: row.id, ...media };
}

async function handleImageUpload(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const rateLimited = await enforceRateLimit(
    request,
    env.OTP,
    `media:${auth.payload.sub}`,
    IMAGE_UPLOADS_PER_HOUR,
    3600,
    env.ENABLE_TEST_ROUTES === 'true',
  );
  if (rateLimited) return rateLimited;

  const declaredLength = Number.parseInt(request.headers.get('Content-Length') ?? '0', 10);
  if (declaredLength && declaredLength > MAX_IMAGE_BYTES) {
    return errorResponse(request, 'fileTooLarge', 413);
  }

  const buffer = await request.arrayBuffer();
  if (buffer.byteLength === 0) return errorResponse(request, 'invalidRequest');
  if (buffer.byteLength > MAX_IMAGE_BYTES) return errorResponse(request, 'fileTooLarge', 413);

  // Never trust the client Content-Type: derive the real type from magic bytes.
  const sniffed = sniffImage(buffer);
  if (!sniffed) return errorResponse(request, 'unsupportedMediaType', 415);

  const dims = readImageDimensions(sniffed.mime, buffer);
  if (dims && (dims.width > MAX_IMAGE_DIMENSION || dims.height > MAX_IMAGE_DIMENSION)) {
    return errorResponse(request, 'imageDimensionsTooLarge', 413);
  }

  const contentHash = await sha256Hex(buffer);
  const lqip = request.headers.get('X-Media-Lqip');

  // Deduplicate: identical bytes from the same owner reuse the stored asset.
  const existing = await env.DB.prepare(
    `SELECT id, kind, provider, provider_id, width, height, duration_ms, lqip, processing_status
     FROM media_assets WHERE owner_id = ? AND content_hash = ?`,
  )
    .bind(auth.payload.sub, contentHash)
    .first<{
      id: string;
      kind: string;
      provider: MediaProvider;
      provider_id: string;
      width: number | null;
      height: number | null;
      duration_ms: number | null;
      lqip: string | null;
      processing_status: string;
    }>();
  if (existing) {
    console.log(
      JSON.stringify({ event: 'media_upload', kind: 'image', deduped: true, provider: existing.provider }),
    );
    const r2Url = existing.provider === 'r2' ? publicUrl(request, env, existing.provider_id) : '';
    const media = assetResponse(env, existing, r2Url);
    return jsonResponse(request, {
      ok: true,
      deduped: true,
      media: { ...media, key: existing.provider === 'r2' ? existing.provider_id : undefined },
    });
  }

  const assetId = crypto.randomUUID();
  let provider: MediaProvider;
  let providerId: string;

  if (imagesEnabled(env)) {
    const uploaded = await uploadToCloudflareImages(env, buffer, sniffed.mime, {
      owner: auth.payload.sub,
      assetId,
    });
    if (!uploaded) return errorResponse(request, 'mediaProcessingFailed', 502);
    provider = 'cf_images';
    providerId = uploaded.id;
  } else {
    // Fallback: store raw bytes in R2 under an owner-scoped key.
    const key = `posts/${auth.payload.sub}/${assetId}.${sniffed.ext}`;
    await env.MEDIA.put(key, buffer, { httpMetadata: { contentType: sniffed.mime } });
    provider = 'r2';
    providerId = key;
  }

  await insertMediaAsset(env, {
    id: assetId,
    ownerId: auth.payload.sub,
    kind: 'image',
    provider,
    providerId,
    contentHash,
    width: dims?.width ?? null,
    height: dims?.height ?? null,
    durationMs: null,
    bytes: buffer.byteLength,
    lqip: lqip ?? null,
    status: 'ready',
  });

  console.log(
    JSON.stringify({
      event: 'media_upload',
      kind: 'image',
      deduped: false,
      provider,
      bytes: buffer.byteLength,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
    }),
  );

  const r2Url = provider === 'r2' ? publicUrl(request, env, providerId) : '';
  const media = assetResponse(
    env,
    {
      id: assetId,
      kind: 'image',
      provider,
      provider_id: providerId,
      width: dims?.width ?? null,
      height: dims?.height ?? null,
      duration_ms: null,
      lqip: lqip ?? null,
      processing_status: 'ready',
    },
    r2Url,
  );
  // Expose the R2 key so legacy attach-by-key keeps working.
  return jsonResponse(request, {
    ok: true,
    media: { ...media, key: provider === 'r2' ? providerId : undefined },
  });
}

async function handleVideoUpload(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  if (!streamEnabled(env)) return errorResponse(request, 'videoUnsupported', 501);

  const rateLimited = await enforceRateLimit(
    request,
    env.OTP,
    `video:${auth.payload.sub}`,
    VIDEO_UPLOADS_PER_HOUR,
    3600,
    env.ENABLE_TEST_ROUTES === 'true',
  );
  if (rateLimited) return rateLimited;

  const direct = await createStreamDirectUpload(env, auth.payload.sub);
  if (!direct) return errorResponse(request, 'mediaProcessingFailed', 502);

  const assetId = crypto.randomUUID();
  await insertMediaAsset(env, {
    id: assetId,
    ownerId: auth.payload.sub,
    kind: 'video',
    provider: 'cf_stream',
    providerId: direct.uid,
    contentHash: null,
    width: null,
    height: null,
    durationMs: null,
    bytes: null,
    lqip: null,
    status: 'pending',
  });

  console.log(JSON.stringify({ event: 'media_upload', kind: 'video', provider: 'cf_stream' }));

  return jsonResponse(request, {
    ok: true,
    mediaAssetId: assetId,
    uploadUrl: direct.uploadURL,
    uid: direct.uid,
  });
}

async function handleStatus(request: Request, env: Env, assetId: string): Promise<Response> {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const row = await env.DB.prepare(
    `SELECT id, owner_id, kind, provider, provider_id, width, height, duration_ms, lqip, processing_status
     FROM media_assets WHERE id = ?`,
  )
    .bind(assetId)
    .first<{
      id: string;
      owner_id: string;
      kind: string;
      provider: MediaProvider;
      provider_id: string;
      width: number | null;
      height: number | null;
      duration_ms: number | null;
      lqip: string | null;
      processing_status: string;
    }>();

  if (!row || row.owner_id !== auth.payload.sub) return errorResponse(request, 'notFound', 404);

  // For pending Stream videos, refresh status live so the client can poll.
  if (row.kind === 'video' && row.processing_status === 'pending' && streamEnabled(env)) {
    const { getStreamVideo } = await import('../lib/cfStream');
    const status = await getStreamVideo(env, row.provider_id);
    const failed = status?.state === 'error';
    if (status?.ready || failed) {
      const nextStatus: ProcessingStatus = failed ? 'failed' : 'ready';
      const durationMs = status?.durationSeconds
        ? Math.round(status.durationSeconds * 1000)
        : null;
      await syncStreamStatus(env, row.provider_id, {
        status: nextStatus,
        width: status?.width ?? null,
        height: status?.height ?? null,
        durationMs,
      });
      row.processing_status = nextStatus;
      row.width = status?.width ?? row.width;
      row.height = status?.height ?? row.height;
      row.duration_ms = durationMs ?? row.duration_ms;
    }
  }

  const r2Url = row.provider === 'r2' ? publicUrl(request, env, row.provider_id) : '';
  return jsonResponse(request, { ok: true, media: assetResponse(env, row, r2Url) });
}

async function handleStreamWebhook(request: Request, env: Env): Promise<Response> {
  const secret = env.CF_STREAM_WEBHOOK_SECRET;
  if (!secret) return errorResponse(request, 'notFound', 404);

  const rawBody = await request.text();
  const valid = await verifyStreamWebhook(secret, request.headers.get('Webhook-Signature'), rawBody);
  if (!valid) return errorResponse(request, 'forbidden', 403);

  const payload = JSON.parse(rawBody) as {
    uid?: string;
    readyToStream?: boolean;
    status?: { state?: string };
    duration?: number;
    input?: { width?: number; height?: number };
  };
  if (!payload.uid) return jsonResponse(request, { ok: true });

  const ready = Boolean(payload.readyToStream);
  const failed = payload.status?.state === 'error';
  const status: ProcessingStatus = ready ? 'ready' : failed ? 'failed' : 'pending';
  const durationMs = payload.duration ? Math.round(payload.duration * 1000) : null;

  await syncStreamStatus(env, payload.uid, {
    status,
    width: payload.input?.width ?? null,
    height: payload.input?.height ?? null,
    durationMs,
  });

  return jsonResponse(request, { ok: true });
}

async function handleR2Read(request: Request, env: Env, path: string): Promise<Response> {
  const key = decodeURIComponent(path.slice('/media/'.length));
  if (!isSafeR2Key(key)) return errorResponse(request, 'notFound', 404);

  const object = await env.MEDIA.get(key);
  if (!object) return errorResponse(request, 'notFound', 404);

  // Conditional GET: return 304 when the client already holds this immutable object.
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, {
      status: 304,
      headers: {
        ...(corsHeaders(request) as Record<string, string>),
        etag: object.httpEtag,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  }

  const headers = new Headers(corsHeaders(request) as HeadersInit);
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

export async function handleMediaRequest(
  request: Request,
  env: Env,
  path: string,
): Promise<Response | null> {
  if (path === '/media/upload' && request.method === 'POST') {
    return handleImageUpload(request, env);
  }

  if (path === '/media/video' && request.method === 'POST') {
    return handleVideoUpload(request, env);
  }

  if (path === '/media/webhook/stream' && request.method === 'POST') {
    return handleStreamWebhook(request, env);
  }

  if (path.startsWith('/media/status/') && request.method === 'GET') {
    const assetId = path.slice('/media/status/'.length);
    if (!assetId) return errorResponse(request, 'notFound', 404);
    return handleStatus(request, env, assetId);
  }

  if (path.startsWith('/media/') && request.method === 'GET') {
    return handleR2Read(request, env, path);
  }

  return null;
}
