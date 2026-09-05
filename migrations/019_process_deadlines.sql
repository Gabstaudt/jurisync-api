-- Prazos processuais: um processo pode ter múltiplos prazos (contestação,
-- recurso, audiência...), diferente do vencimento único de um contrato.
CREATE TABLE IF NOT EXISTS process_deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente','cumprido','perdido')) DEFAULT 'pendente',
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_process_deadlines_process ON process_deadlines(process_id);
CREATE INDEX IF NOT EXISTS idx_process_deadlines_ecosystem ON process_deadlines(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_process_deadlines_due_date ON process_deadlines(due_date);
CREATE INDEX IF NOT EXISTS idx_process_deadlines_status ON process_deadlines(status);
