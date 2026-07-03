CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  first_name TEXT,
  last_name TEXT,
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  instruments TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  token_version INTEGER NOT NULL DEFAULT 0,
  posts_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_media (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  media_asset_id TEXT,
  provider TEXT NOT NULL DEFAULT 'r2',
  provider_id TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  poster_url TEXT,
  lqip TEXT,
  processing_status TEXT NOT NULL DEFAULT 'ready',
  FOREIGN KEY (post_id) REFERENCES posts (id)
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON post_media (post_id, sort_order);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  content_hash TEXT,
  width INTEGER,
  height INTEGER,
  duration_ms INTEGER,
  bytes INTEGER,
  lqip TEXT,
  processing_status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_dedup
  ON media_assets (owner_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_media_assets_owner ON media_assets (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_provider ON media_assets (provider, provider_id);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes (user_id, post_id);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  parent_id TEXT,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (post_id) REFERENCES posts (id),
  FOREIGN KEY (author_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  type TEXT NOT NULL,
  post_id TEXT,
  comment_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (actor_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, read_at);
