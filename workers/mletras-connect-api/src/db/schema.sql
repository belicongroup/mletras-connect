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
