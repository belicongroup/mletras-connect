-- Phase 1: profile persistence + auth hardening columns.
-- Run once against an existing database that predates these columns.
-- (Fresh databases already get these from schema.sql.)
ALTER TABLE users ADD COLUMN updated_at TEXT;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN posts_count INTEGER NOT NULL DEFAULT 0;
