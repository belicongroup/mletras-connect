/**
 * Scheduled media lifecycle cleanup (runs from a Cron Trigger).
 *
 * Two classes of orphans accumulate without this sweep:
 *  1. Abandoned assets — uploaded, then the post was never created.
 *  2. R2 objects — written directly but never linked in the database.
 *
 * Both waste storage indefinitely. We only touch items older than a grace
 * window so in-flight uploads are never collected mid-compose.
 */
import { deleteProviderAsset } from './media';
import type { Env } from './env';

const GRACE_MS = 24 * 60 * 60 * 1000; // 24h
const BATCH = 100;

export async function sweepOrphanedMedia(env: Env): Promise<{ assets: number; objects: number }> {
  const cutoff = new Date(Date.now() - GRACE_MS).toISOString();

  // 1. Assets uploaded but never attached to a post.
  const abandoned = await env.DB.prepare(
    `SELECT id, provider, provider_id
     FROM media_assets
     WHERE created_at < ?
       AND id NOT IN (SELECT media_asset_id FROM post_media WHERE media_asset_id IS NOT NULL)
     LIMIT ?`,
  )
    .bind(cutoff, BATCH)
    .all<{ id: string; provider: 'r2' | 'cf_images' | 'cf_stream'; provider_id: string }>();

  let assets = 0;
  for (const a of abandoned.results ?? []) {
    const r2Key = a.provider === 'r2' ? a.provider_id : null;
    await deleteProviderAsset(env, a.provider, a.provider_id, r2Key);
    await env.DB.prepare('DELETE FROM media_assets WHERE id = ?').bind(a.id).run();
    assets += 1;
  }

  // 2. R2 objects with no owning row (e.g. legacy uploads that failed post create).
  let objects = 0;
  const listed = await env.MEDIA.list({ prefix: 'posts/', limit: BATCH });
  for (const obj of listed.objects) {
    if (obj.uploaded && obj.uploaded.toISOString() >= cutoff) continue;
    const linked = await env.DB.prepare(
      `SELECT 1 FROM post_media WHERE r2_key = ? OR provider_id = ? LIMIT 1`,
    )
      .bind(obj.key, obj.key)
      .first();
    if (linked) continue;
    const asset = await env.DB.prepare(
      `SELECT 1 FROM media_assets WHERE provider = 'r2' AND provider_id = ? LIMIT 1`,
    )
      .bind(obj.key)
      .first();
    if (asset) continue;
    await env.MEDIA.delete(obj.key).catch(() => undefined);
    objects += 1;
  }

  // Structured metric for observability dashboards.
  console.log(JSON.stringify({ event: 'media_sweep', assets, objects, cutoff }));
  return { assets, objects };
}
