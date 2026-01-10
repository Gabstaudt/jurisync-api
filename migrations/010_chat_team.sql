-- Adiciona suporte a conversas por equipe
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Garante unicidade de conversa por equipe dentro do ecossistema
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_team ON chat_conversations(team_id, ecosystem_id) WHERE team_id IS NOT NULL;

-- Índice para filtrar conversas por equipe
CREATE INDEX IF NOT EXISTS idx_chat_conversations_team ON chat_conversations(team_id);
