-- Processos
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('ativo','em_andamento','encerrado')) DEFAULT 'ativo',
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processes_ecosystem ON processes(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_processes_folder ON processes(folder_id);
CREATE INDEX IF NOT EXISTS idx_processes_status ON processes(status);
