-- Configuracoes do usuario (preferencias)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  notifications JSONB NOT NULL DEFAULT '{
    "emailEnabled": true,
    "contractExpiry": true,
    "weeklyReport": true,
    "commentNotifications": true,
    "daysBeforeExpiry": 7
  }',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_ecosystem ON user_settings(ecosystem_id);
