-- Vincula tarefas a processos (hoje só era possível vincular a contratos)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_process ON tasks(process_id);
