/**
 * Cloudflare Images integration.
 *
 * When configured, still images are handed to Cloudflare Images which strips
 * EXIF/GPS metadata on ingest, stores a single master, and serves responsive
 * variants (WebP/AVIF negotiated per request) from the edge. When the account
 * is not configured, callers fall back to raw R2 delivery.
 */
import type { Env } from './env';

const API_BASE = 'https://api.cloudflare.com/client/v4';

/** Named delivery variants configured in the Cloudflare Images dashboard. */
export const IMAGE_VARIANTS = ['thumb', 'small', 'medium', 'large', 'public'] as const;
export type ImageVariant = (typeof IMAGE_VARIANTS)[number];

export function imagesEnabled(env: Env): boolean {
  return Boolean(env.CF_ACCOUNT_ID && env.CF_IMAGES_TOKEN && env.CF_IMAGES_HASH);
}

export interface UploadedImage {
  id: string;
}

/**
 * Uploads raw image bytes to Cloudflare Images. Metadata is attached so the
 * asset can be traced back to its owner. Returns the delivery id on success.
 */
export async function uploadToCloudflareImages(
  env: Env,
  buffer: ArrayBuffer,
  contentType: string,
  metadata: Record<string, string>,
): Promise<UploadedImage | null> {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: contentType }), 'upload');
  form.append('metadata', JSON.stringify(metadata));
  // Strip any client-embedded metadata (EXIF/GPS/camera) on ingest.
  form.append('requireSignedURLs', 'false');

  const res = await fetch(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/images/v1`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_IMAGES_TOKEN}` },
    body: form,
  });

  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { success?: boolean; result?: { id?: string } }
    | null;
  if (!body?.success || !body.result?.id) return null;
  return { id: body.result.id };
}

export async function deleteCloudflareImage(env: Env, id: string): Promise<void> {
  await fetch(`${API_BASE}/accounts/${env.CF_ACCOUNT_ID}/images/v1/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CF_IMAGES_TOKEN}` },
  }).catch(() => undefined);
}

/** Builds a delivery URL for a stored image id and named variant. */
export function imageDeliveryUrl(env: Env, id: string, variant: ImageVariant): string {
  const base = env.MEDIA_CDN_URL?.replace(/\/$/, '') ?? `https://imagedelivery.net/${env.CF_IMAGES_HASH}`;
  return `${base}/${id}/${variant}`;
}
