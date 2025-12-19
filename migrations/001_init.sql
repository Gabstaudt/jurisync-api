-- JuriSync API - schema inicial
-- Requisitos: Postgres 13+ com extensão pgcrypto

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Usuários e sessões
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','user')) DEFAULT 'user',
  department TEXT,
  phone TEXT,
  invite_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','user')) DEFAULT 'user',
  department TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Pastas
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  icon TEXT,
  parent_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  path TEXT[] NOT NULL DEFAULT '{}',
  type TEXT NOT NULL CHECK (type IN ('system','custom','category')) DEFAULT 'custom',
  permissions JSONB NOT NULL DEFAULT '{"isPublic":true,"canView":[],"canEdit":[],"canManage":[]}',
  contract_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contratos
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  contracting_company TEXT NOT NULL,
  contracted_party TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  value NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  internal_responsible TEXT NOT NULL,
  responsible_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','expiring_soon','expired','draft','archived')) DEFAULT 'active',
  priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','critical')) DEFAULT 'medium',
  tags TEXT[] NOT NULL DEFAULT '{}',
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  permissions JSONB NOT NULL DEFAULT '{"isPublic":true,"canView":[],"canEdit":[],"canComment":[]}',
  attachments JSONB NOT NULL DEFAULT '[]',
  notifications JSONB NOT NULL DEFAULT '[]',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
CREATE INDEX IF NOT EXISTS idx_contracts_folder ON contracts(folder_id);

CREATE TABLE IF NOT EXISTS contract_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  mentions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contract_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  field TEXT,
  old_value TEXT,
  new_value TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notificações de contrato (próximos 7 dias ou vencido)
CREATE TABLE IF NOT EXISTS contract_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('expiry_reminder','expiry_warning','custom')),
  message TEXT,
  recipients TEXT[] NOT NULL DEFAULT '{}',
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seeds básicos para bater com o front
INSERT INTO users (id, name, email, password_hash, role, department, phone, invite_code)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin Principal', 'admin@jurisync.com', crypt('admin123', gen_salt('bf')), 'admin', 'TI', '+55 11 99999-9999', 'JURISYNC2024'),
  ('00000000-0000-0000-0000-000000000002', 'Joao Silva', 'joao@jurisync.com', crypt('joao123', gen_salt('bf')), 'manager', 'Juridico', '+55 11 98888-8888', 'JURISYNC2024'),
  ('00000000-0000-0000-0000-000000000003', 'Maria Santos', 'maria@jurisync.com', crypt('maria123', gen_salt('bf')), 'user', 'Financeiro', '+55 11 97777-7777', 'JURISYNC2024')
ON CONFLICT DO NOTHING;

INSERT INTO invite_codes (code, role, department, created_by, expires_at, is_active)
VALUES ('JURISYNC2024', 'user', 'Geral', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '90 days', TRUE)
ON CONFLICT DO NOTHING;
