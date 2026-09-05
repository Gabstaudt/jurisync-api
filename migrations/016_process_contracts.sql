-- Relacionamento entre processos e contratos (N:N)
CREATE TABLE IF NOT EXISTS process_contracts (
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (process_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_process_contracts_ecosystem ON process_contracts(ecosystem_id);
CREATE INDEX IF NOT EXISTS idx_process_contracts_process ON process_contracts(process_id);
CREATE INDEX IF NOT EXISTS idx_process_contracts_contract ON process_contracts(contract_id);
