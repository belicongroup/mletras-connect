-- Phase 3: comments and notifications.
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
