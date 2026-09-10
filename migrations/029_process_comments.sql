CREATE TABLE IF NOT EXISTS process_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_comments_process ON process_comments(process_id, created_at DESC);
