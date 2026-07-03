/**
 * Provider-agnostic media serialization and persistence.
 *
 * Post attachments may live in three places — raw R2 (legacy / fallback),
 * Cloudflare Images (responsive variants), or Cloudflare Stream (HLS video).
 * This module hides those differences behind one serialized shape the client
 * consumes, and owns writing/deleting the underlying assets.
 */
import { imageDeliveryUrl, imagesEnabled, type ImageVariant } from './cfImages';
import { streamHlsUrl, streamPosterUrl } from './cfStream';
import type { Env } from './env';

export type MediaProvider = 'r2' | 'cf_images' | 'cf_stream';
export type ProcessingStatus = 'ready' | 'pending' | 'failed';

export interface PostMediaRow {
  post_id: string;
  type: string;
  url: string;
  sort_order: number;
  provider: MediaProvider | null;
  provider_id: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  poster_url: string | null;
  lqip: string | null;
  processing_status: ProcessingStatus | null;
}

export interface ImageVariantUrls {
  thumb: string;
  small: string;
  medium: string;
  large: string;
  original: string;
}

export interface SerializedMedia {
  type: 'image' | 'video';
  /** Sensible default URL: medium image variant, or HLS manifest for video. */
  url: string;
  width?: number;
  height?: number;
  lqip?: string;
  processingStatus: ProcessingStatus;
  /** Responsive image variants; the client picks by screen size + network. */
  variants?: ImageVariantUrls;
  /** Video-only fields. */
  hlsUrl?: string;
  posterUrl?: string;
  durationMs?: number;
}

const VARIANT_KEYS: Record<keyof ImageVariantUrls, ImageVariant> = {
  thumb: 'thumb',
  small: 'small',
  medium: 'medium',
  large: 'large',
  original: 'public',
};

/** Builds the responsive variant set for an image row across providers. */
function buildImageVariants(env: Env, row: PostMediaRow): ImageVariantUrls {
  if (row.provider === 'cf_images' && row.provider_id) {
    return {
      thumb: imageDeliveryUrl(env, row.provider_id, VARIANT_KEYS.thumb),
      small: imageDeliveryUrl(env, row.provider_id, VARIANT_KEYS.small),
      medium: imageDeliveryUrl(env, row.provider_id, VARIANT_KEYS.medium),
      large: imageDeliveryUrl(env, row.provider_id, VARIANT_KEYS.large),
      original: imageDeliveryUrl(env, row.provider_id, VARIANT_KEYS.original),
    };
  }
  // R2 fallback: one stored object serves every size (client pre-compresses).
  const url = row.url;
  return { thumb: url, small: url, medium: url, large: url, original: url };
}

/** Converts a post_media DB row into the client-facing media object. */
export function serializePostMedia(env: Env, row: PostMediaRow): SerializedMedia {
  const status: ProcessingStatus = row.processing_status ?? 'ready';

  if (row.type === 'video') {
    const uid = row.provider_id;
    const hlsUrl = uid ? streamHlsUrl(env, uid) : row.url;
    return {
      type: 'video',
      url: hlsUrl,
      hlsUrl,
      posterUrl: row.poster_url ?? (uid ? streamPosterUrl(env, uid) : undefined),
      width: row.width ?? undefined,
      height: row.height ?? undefined,
      durationMs: row.duration_ms ?? undefined,
      processingStatus: status,
    };
  }

  const variants = buildImageVariants(env, row);
  return {
    type: 'image',
    url: variants.medium,
    variants,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    lqip: row.lqip ?? undefined,
    processingStatus: status,
  };
}

/** Removes the backing asset for a post_media row from its provider. */
export async function deleteProviderAsset(
  env: Env,
  provider: MediaProvider | null,
  providerId: string | null,
  r2Key: string | null,
): Promise<void> {
  if (provider === 'cf_images' && providerId && imagesEnabled(env)) {
    const { deleteCloudflareImage } = await import('./cfImages');
    await deleteCloudflareImage(env, providerId);
    return;
  }
  if (provider === 'cf_stream' && providerId) {
    const { deleteStreamVideo } = await import('./cfStream');
    await deleteStreamVideo(env, providerId);
    return;
  }
  if (r2Key) {
    await env.MEDIA.delete(r2Key).catch(() => undefined);
  }
}
