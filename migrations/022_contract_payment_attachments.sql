-- Anexos por parcela (comprovante, nota fiscal, etc).
ALTER TABLE contract_payments
  ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]';
