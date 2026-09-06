-- Parcelas/pagamentos de um contrato: permite acompanhar quanto já foi
-- pago e quanto falta, mês a mês, ao longo da vigência do contrato.
CREATE TABLE IF NOT EXISTS contract_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pendente','pago')) DEFAULT 'pendente',
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_payments_contract ON contract_payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_ecosystem ON contract_payments(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_contract_payments_due_date ON contract_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_payments_status ON contract_payments(status);
