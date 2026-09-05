-- Vincula um contrato ao seu contrato original, permitindo registrar
-- aditivos/renegociações sem perder o histórico do documento anterior.
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS parent_contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_parent ON contracts(parent_contract_id);
