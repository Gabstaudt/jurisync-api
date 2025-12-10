-- Add ecosystems and access codes, and scope users/records by ecosystem

-- Ecosystems table
CREATE TABLE IF NOT EXISTS ecosystems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Access codes (admin/manager/user) scoped to ecosystem
CREATE TABLE IF NOT EXISTS access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem_id UUID NOT NULL REFERENCES ecosystems(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','user')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Add ecosystem_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS ecosystem_id UUID;
-- Relax unique on email to be per-ecosystem
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name='users' AND constraint_type='UNIQUE' AND constraint_name='users_email_key'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_email_key;
  END IF;
END $$;
ALTER TABLE users
  ADD CONSTRAINT users_email_ecosystem_unique UNIQUE (email, ecosystem_id);

-- Add ecosystem_id to folders and contracts
ALTER TABLE folders ADD COLUMN IF NOT EXISTS ecosystem_id UUID;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS ecosystem_id UUID;

-- Seed a default ecosystem for existing data, if none
DO $$
DECLARE
  eco_id UUID;
BEGIN
  SELECT id INTO eco_id FROM ecosystems LIMIT 1;
  IF eco_id IS NULL THEN
    INSERT INTO ecosystems (id, name) VALUES ('11111111-1111-1111-1111-111111111111', 'Ecosystem 1') ON CONFLICT DO NOTHING;
    eco_id := '11111111-1111-1111-1111-111111111111';
  END IF;

  -- Attach existing users/folders/contracts to the ecosystem
  UPDATE users SET ecosystem_id = COALESCE(ecosystem_id, eco_id);
  UPDATE folders SET ecosystem_id = COALESCE(ecosystem_id, eco_id);
  UPDATE contracts SET ecosystem_id = COALESCE(ecosystem_id, eco_id);
END $$;

-- Enforce NOT NULL after backfilling
ALTER TABLE users ALTER COLUMN ecosystem_id SET NOT NULL;
ALTER TABLE folders ALTER COLUMN ecosystem_id SET NOT NULL;
ALTER TABLE contracts ALTER COLUMN ecosystem_id SET NOT NULL;
