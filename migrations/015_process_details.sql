ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS involved_parties TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS responsible_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS action_group TEXT,
  ADD COLUMN IF NOT EXISTS phase TEXT,
  ADD COLUMN IF NOT EXISTS cnj_number TEXT,
  ADD COLUMN IF NOT EXISTS protocol_number TEXT,
  ADD COLUMN IF NOT EXISTS origin_process TEXT,
  ADD COLUMN IF NOT EXISTS request_date DATE,
  ADD COLUMN IF NOT EXISTS claim_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS fees_value NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS fees_percentage NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS contingency TEXT CHECK (contingency IN ('alta','possivel','remota'));

CREATE INDEX IF NOT EXISTS idx_processes_responsible ON processes(responsible_id);
CREATE INDEX IF NOT EXISTS idx_processes_cnj ON processes(cnj_number);
