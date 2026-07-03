import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { API_URL } from '../config/api';
import { getToken } from './profileService';
import type { ImageVariantUrls, PostMedia } from '../types';

/**
 * Client media pipeline: pre-compress and downscale before upload to cut upload
 * time and server load, then upload with progress + retry. Images post to the
 * Worker (which routes to Cloudflare Images or R2); videos upload directly to a
 * one-time Cloudflare Stream URL so large files never transit the Worker.
 */

const MAX_UPLOAD_DIMENSION = 4096; // long edge cap sent to the server
const UPLOAD_QUALITY = 0.8;
const LQIP_DIMENSION = 24; // tiny placeholder edge
const MAX_RETRIES = 3;

export interface UploadedMedia {
  mediaAssetId: string;
  type: 'image' | 'video';
  /** Optimistic media object for immediate local rendering. */
  media: PostMedia;
}

export type ProgressCallback = (fraction: number) => void;

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ProcessedImage {
  uri: string;
  width: number;
  height: number;
  lqip?: string;
}

/**
 * Downscales to the max edge (only when oversized) and produces a tiny base64
 * LQIP placeholder for progressive display. Preserves aspect ratio throughout.
 */
async function preprocessImage(
  uri: string,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<ProcessedImage> {
  const longest = Math.max(sourceWidth ?? 0, sourceHeight ?? 0);
  const needsResize = longest > MAX_UPLOAD_DIMENSION;

  const context = ImageManipulator.manipulate(uri);
  if (needsResize && sourceWidth && sourceHeight) {
    if (sourceWidth >= sourceHeight) {
      context.resize({ width: MAX_UPLOAD_DIMENSION, height: null });
    } else {
      context.resize({ width: null, height: MAX_UPLOAD_DIMENSION });
    }
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: UPLOAD_QUALITY,
    format: SaveFormat.JPEG,
  });

  let lqip: string | undefined;
  try {
    const lqipContext = ImageManipulator.manipulate(uri);
    lqipContext.resize({ width: LQIP_DIMENSION, height: null });
    const lqipRendered = await lqipContext.renderAsync();
    const lqipSaved = await lqipRendered.saveAsync({
      compress: 0.4,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (lqipSaved.base64) lqip = `data:image/jpeg;base64,${lqipSaved.base64}`;
  } catch {
    // LQIP is a progressive-loading nicety; never block upload on it.
  }

  return { uri: saved.uri, width: rendered.width, height: rendered.height, lqip };
}

interface XhrResult {
  status: number;
  body: string;
}

/** Promisified XHR upload with progress reporting (fetch lacks upload progress). */
function xhrUpload(
  url: string,
  method: string,
  body: Blob | FormData,
  headers: Record<string, string>,
  onProgress?: ProgressCallback,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(e.loaded / e.total);
      };
    }
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText });
    xhr.onerror = () => reject(new Error('networkError'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });
}

/** Retries transient failures (network + 5xx) with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, isRetryable: (r: T) => boolean): Promise<T | null> {
  let lastResult: T | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      const result = await fn();
      lastResult = result;
      if (!isRetryable(result)) return result;
    } catch {
      lastResult = null;
    }
    if (attempt < MAX_RETRIES - 1) await delay(2 ** attempt * 500);
  }
  return lastResult;
}

export async function uploadImage(
  uri: string,
  onProgress?: ProgressCallback,
  sourceWidth?: number,
  sourceHeight?: number,
): Promise<UploadedMedia | null> {
  try {
    const processed = await preprocessImage(uri, sourceWidth, sourceHeight);
    const fileResponse = await fetch(processed.uri);
    const blob = await fileResponse.blob();

    const headers: Record<string, string> = {
      ...(await authHeader()),
      'Content-Type': 'image/jpeg',
    };
    if (processed.lqip) headers['X-Media-Lqip'] = processed.lqip;

    const result = await withRetry(
      () => xhrUpload(`${API_URL}/media/upload`, 'POST', blob, headers, onProgress),
      (r) => r.status >= 500 || r.status === 0,
    );
    if (!result || result.status < 200 || result.status >= 300) return null;

    const body = JSON.parse(result.body) as {
      ok?: boolean;
      media?: PostMedia & { mediaAssetId?: string };
    };
    if (!body.ok || !body.media?.mediaAssetId) return null;

    const { mediaAssetId, ...media } = body.media;
    return { mediaAssetId, type: 'image', media };
  } catch {
    return null;
  }
}

export async function uploadVideo(
  uri: string,
  onProgress?: ProgressCallback,
): Promise<UploadedMedia | null> {
  try {
    // 1. Ask the Worker for a one-time Stream upload URL (also creates the asset).
    const ticketRes = await fetch(`${API_URL}/media/video`, {
      method: 'POST',
      headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
    });
    const ticket = (await ticketRes.json().catch(() => null)) as
      | { ok?: boolean; mediaAssetId?: string; uploadUrl?: string }
      | null;
    if (!ticketRes.ok || !ticket?.ok || !ticket.mediaAssetId || !ticket.uploadUrl) return null;

    // 2. Upload the file directly to Cloudflare Stream (bypasses the Worker).
    const fileResponse = await fetch(uri);
    const blob = await fileResponse.blob();
    const form = new FormData();
    form.append('file', blob as unknown as Blob, 'upload.mp4');

    const uploadResult = await withRetry(
      () => xhrUpload(ticket.uploadUrl!, 'POST', form, {}, onProgress),
      (r) => r.status >= 500 || r.status === 0,
    );
    if (!uploadResult || uploadResult.status < 200 || uploadResult.status >= 300) return null;

    // Stream transcodes asynchronously; the asset starts as `pending`.
    return {
      mediaAssetId: ticket.mediaAssetId,
      type: 'video',
      media: { type: 'video', url: '', processingStatus: 'pending' },
    };
  } catch {
    return null;
  }
}

/** Polls processing status for an asset (used while a video transcodes). */
export async function getMediaStatus(mediaAssetId: string): Promise<PostMedia | null> {
  try {
    const res = await fetch(`${API_URL}/media/status/${mediaAssetId}`, {
      headers: await authHeader(),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; media?: PostMedia }
      | null;
    if (!res.ok || !body?.ok || !body.media) return null;
    return body.media;
  } catch {
    return null;
  }
}

/**
 * Picks the smallest image variant that still covers the target render width,
 * saving bandwidth on small screens and slow networks.
 */
export function pickImageUrl(media: PostMedia, targetWidthPx: number): string {
  const v: ImageVariantUrls | undefined = media.variants;
  if (!v) return media.url;
  if (targetWidthPx <= 150) return v.thumb;
  if (targetWidthPx <= 640) return v.small;
  if (targetWidthPx <= 1080) return v.medium;
  return v.large;
}
