ALTER TABLE processes
  ADD COLUMN IF NOT EXISTS stage TEXT;

ALTER TABLE process_deadlines
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb;
