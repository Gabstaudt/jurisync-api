-- Vincula partes já cadastradas (tabela parties) a um processo,
-- com papel processual (ativa/passiva/advogado/outro) e, no caso de
-- advogado, qual parte ele representa.
CREATE TABLE IF NOT EXISTS process_parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  side TEXT CHECK (side IN ('ativa','passiva','advogado','outro')),
  represents_party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (process_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_process_parties_process ON process_parties(process_id);
CREATE INDEX IF NOT EXISTS idx_process_parties_party ON process_parties(party_id);
CREATE INDEX IF NOT EXISTS idx_process_parties_ecosystem ON process_parties(ecosystem_id);
