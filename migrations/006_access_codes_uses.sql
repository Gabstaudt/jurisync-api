-- Add usage limits to access codes and handle expiration

ALTER TABLE access_codes
  ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;

-- Mark expired or overused codes as inactive
UPDATE access_codes
   SET is_active = FALSE
 WHERE is_active = TRUE
   AND (
     (expires_at IS NOT NULL AND expires_at <= NOW())
     OR used_count >= max_uses
   );

CREATE INDEX IF NOT EXISTS idx_access_codes_active ON access_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_access_codes_expiry ON access_codes(expires_at);
