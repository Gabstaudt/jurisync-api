-- Track pending users and activation token for admin-created accounts

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pending BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS activation_token TEXT;

-- Backfill existing users as active and not pending
UPDATE users
   SET is_pending = FALSE,
       is_active = COALESCE(is_active, TRUE)
 WHERE is_pending IS NULL;

-- Optional index to speed up activation token lookup
CREATE INDEX IF NOT EXISTS idx_users_activation_token ON users(activation_token);
