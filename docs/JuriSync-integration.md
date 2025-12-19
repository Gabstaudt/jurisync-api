# Integração JuriSync (frontend) → jurisync-api

## Endpoints principais
- Auth
  - `POST /api/auth/login` → `{ email, password }` → `{ token, user }`
  - `POST /api/auth/register` → `{ name, email, password, inviteCode, department?, phone? }` → `{ token, user }`
  - `GET /api/auth/me` (Bearer token)
  - `POST /api/auth/logout`
- Convites
  - `GET /api/invite-codes?active=true` (admin)
  - `POST /api/invite-codes` (admin) `{ role, email?, department?, expiresAt?, code? }`
- Usuários
  - `GET /api/users` (admin)
  - `POST /api/users` (admin) `{ name, email, role, password?, department?, phone?, inviteCode? }`
  - `GET /api/users/{id}` (admin ou o próprio)
  - `PATCH /api/users/{id}` (admin ou o próprio) `{ name?, email?, role?, department?, phone?, isActive? }`
- Pastas
  - `GET /api/folders` (gera pastas sistema se faltarem)
  - `POST /api/folders` (admin/manager) `{ name, description?, color?, icon?, parentId?, type?, permissions? }`
  - `GET /api/folders/{id}`
  - `PATCH /api/folders/{id}` (admin/manager)
  - `GET /api/folders/{id}/contracts`
- Contratos
  - `GET /api/contracts?status=&q=&folderId=&page=&limit=` (status calcula `expiring_soon` se faltarem ≤7 dias)
  - `POST /api/contracts` (auth) — campos em camelCase iguais ao front
  - `GET /api/contracts/{id}`
  - `PATCH /api/contracts/{id}`
  - `GET/POST /api/contracts/{id}/comments`
  - `GET/POST /api/contracts/{id}/history`
  - `GET/POST /api/contracts/{id}/notifications`
  - `GET /api/contracts/export?format=csv`

## Mapeamento de campos (front → API)
- Contrato: `contractingCompany -> contracting_company`, `contractedParty`, `internalResponsible`, `responsibleEmail`, `startDate/endDate` (ISO string), `value`, `priority`, `tags`, `folderId`, `permissions { isPublic, canView, canEdit, canComment }`.
- Pasta: `parentId`, `path`, `permissions { isPublic, canView, canEdit, canManage }`.
- Usuário: responde `{ id, name, email, role, department, phone, inviteCode, isActive, lastLoginAt, createdAt, updatedAt }`.

## Sessão
- Envie `Authorization: Bearer {token}` em todas as rotas protegidas.
- Token de login expira em 7 dias; faça refresh via `/api/auth/me`.

## Passos rápidos para o frontend JuriSync
1) Configure base URL (ex.: `.env` → `VITE_API_URL=http://localhost:3000` ou endpoint de produção).
2) No cliente HTTP, adicione interceptor para incluir `Authorization` se houver token salvo.
3) Substitua chamadas mock/localStorage pelos endpoints acima:
   - Login/registro usam `/api/auth/*`.
   - Lista de usuários e convites: `/api/users`, `/api/invite-codes`.
   - Pastas: `/api/folders`, `/api/folders/{id}/contracts`.
   - Contratos: `/api/contracts` e rotas aninhadas para comentários/histórico/notificações.
   - Exportação: baixar CSV de `/api/contracts/export`.

## Seeds disponíveis (após rodar migração)
- Admin: `admin@jurisync.com / admin123`
- Manager: `joao@jurisync.com / joao123`
- User: `maria@jurisync.com / maria123`
- Código de convite: `JURISYNC2024`
