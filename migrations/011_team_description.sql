-- Adiciona descrição às equipes
ALTER TABLE teams ADD COLUMN IF NOT EXISTS description TEXT;
