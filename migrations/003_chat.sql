-- Chat basico: conversas, participantes e mensagens

CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  title TEXT,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_ecosystem ON chat_conversations(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_last ON chat_conversations(ecosystem_id, last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS chat_participants (
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  content TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at DESC);

-- Seed de uma conversa privada entre admin e usuario para ambientes de demo/local
DO $$
DECLARE
  conv_id UUID;
  admin_id UUID := '00000000-0000-0000-0000-000000000001';
  user_id UUID := '00000000-0000-0000-0000-000000000003';
  eco_id UUID;
BEGIN
  SELECT ecosystem_id INTO eco_id FROM users WHERE id = admin_id;
  IF eco_id IS NOT NULL THEN
    SELECT id INTO conv_id FROM chat_conversations WHERE is_group = FALSE LIMIT 1;
    IF conv_id IS NULL THEN
      INSERT INTO chat_conversations (ecosystem_id, is_group, created_by, last_message_at, last_message_preview)
      VALUES (eco_id, FALSE, admin_id, NOW(), 'Bem-vindo ao chat interno!')
      RETURNING id INTO conv_id;

      INSERT INTO chat_participants (conversation_id, user_id, last_read_at)
      VALUES (conv_id, admin_id, NOW()), (conv_id, user_id, NULL)
      ON CONFLICT DO NOTHING;

      INSERT INTO chat_messages (conversation_id, sender_id, content)
      VALUES (conv_id, admin_id, 'Bem-vindo ao chat interno!')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
