-- Guest auto-access: soft identities that can later claim a real account.
ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0;
