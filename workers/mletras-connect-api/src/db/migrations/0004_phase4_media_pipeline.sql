-- Phase 4: production media pipeline (responsive images, video, dedup, lifecycle).

-- Canonical record of every processed upload. Acts as the dedup source of
-- truth: identical bytes re-uploaded by the same owner reuse one asset.
CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,                         -- 'image' | 'video'
  provider TEXT NOT NULL,                     -- 'r2' | 'cf_images' | 'cf_stream'
  provider_id TEXT NOT NULL,                  -- r2 key | images id | stream uid
  content_hash TEXT,                          -- sha256 hex (images only; null for stream)
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  bytes INTEGER,
  lqip TEXT,                                  -- tiny base64 placeholder for progressive load
  processing_status TEXT NOT NULL DEFAULT 'ready', -- 'ready' | 'pending' | 'failed'
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_dedup
  ON media_assets (owner_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_provider ON media_assets (provider, provider_id);

-- Extend post_media with provider-aware, responsive-ready metadata. Legacy
-- rows keep working via the original r2_key/url columns.
ALTER TABLE post_media ADD COLUMN media_asset_id TEXT;
ALTER TABLE post_media ADD COLUMN provider TEXT NOT NULL DEFAULT 'r2';
ALTER TABLE post_media ADD COLUMN provider_id TEXT;
ALTER TABLE post_media ADD COLUMN width INTEGER;
ALTER TABLE post_media ADD COLUMN height INTEGER;
ALTER TABLE post_media ADD COLUMN duration_ms INTEGER;
ALTER TABLE post_media ADD COLUMN poster_url TEXT;
ALTER TABLE post_media ADD COLUMN lqip TEXT;
ALTER TABLE post_media ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'ready';
