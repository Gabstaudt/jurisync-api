-- Add per-user permissions storage

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS permissions JSONB;

-- No backfill; UI/back-end will fallback to role defaults when null
