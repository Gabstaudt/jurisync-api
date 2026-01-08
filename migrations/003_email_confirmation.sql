-- Add email verification fields to users

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verification_token TEXT;

-- Index to lookup by token quickly
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
