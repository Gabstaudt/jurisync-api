-- Histórico de modelos de contrato
CREATE TABLE IF NOT EXISTS contract_template_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES contract_templates(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('create','update','delete')),
  changed_fields JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_template_history_template ON contract_template_history(template_id);
