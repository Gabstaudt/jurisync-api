-- Responsáveis múltiplos por contrato

CREATE TABLE IF NOT EXISTS contract_responsibles (
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_responsibles_contract ON contract_responsibles(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_responsibles_user ON contract_responsibles(user_id);
