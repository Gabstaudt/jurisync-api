import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SYSTEM_FOLDERS = [
  {
    name: "Todos os Contratos",
    description: "Todos os contratos do sistema",
    color: "#3B82F6",
    icon: "Folder",
    type: "system",
  },
  {
    name: "Contratos Ativos",
    description: "Contratos com status ativo",
    color: "#10B981",
    icon: "Shield",
    type: "system",
  },
  {
    name: "Vencendo em Breve",
    description: "Contratos que vencem nos próximos dias",
    color: "#F59E0B",
    icon: "AlertTriangle",
    type: "system",
  },
];

async function ensureSystemFolders(userId?: string) {
  for (const folder of SYSTEM_FOLDERS) {
    await q(
      `INSERT INTO folders (name, description, color, icon, type, permissions, created_by)
       SELECT $1,$2,$3,$4,$5,$6,$7
       WHERE NOT EXISTS (
         SELECT 1 FROM folders WHERE name = $1 AND type = $5
       )`,
      [
        folder.name,
        folder.description,
        folder.color,
        folder.icon,
        folder.type,
        '{"isPublic":true,"canView":[],"canEdit":[],"canManage":[]}',
        userId || null,
      ],
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request) {
  const session = await requireAuth(req);
  await ensureSystemFolders(session?.user.id);

  const { rows } = await q(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM contracts c WHERE c.folder_id = f.id) AS contract_count_calc
     FROM folders f
     ORDER BY created_at DESC`,
  );

  const data = rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
    icon: r.icon,
    parentId: r.parent_id,
    path: r.path,
    type: r.type,
    permissions: r.permissions,
    contractCount: Number(r.contract_count_calc ?? r.contract_count ?? 0),
    isActive: r.is_active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json(data, { headers: H });
}

export async function POST(req: Request) {
  const session = await requireAuth(req);
  if (!session || !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: H },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "Nome é obrigatório" },
      { status: 400, headers: H },
    );
  }

  const parentId = body.parentId || null;
  let path: string[] = [];
  if (parentId) {
    const { rows: parents } = await q(
      "SELECT id, path FROM folders WHERE id = $1",
      [parentId],
    );
    if (!parents[0]) {
      return NextResponse.json(
        { error: "Pasta pai não encontrada" },
        { status: 404, headers: H },
      );
    }
    path = [...(parents[0].path || []), parentId];
  }

  const permissions =
    body.permissions ||
    { isPublic: true, canView: [], canEdit: [], canManage: [] };

  const { rows } = await q(
    `INSERT INTO folders
      (name, description, color, icon, parent_id, path, type, permissions, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      name,
      body.description || null,
      body.color || "#3B82F6",
      body.icon || "Folder",
      parentId,
      path,
      body.type || "custom",
      permissions,
      session.user.id,
    ],
  );

  const f = rows[0];
  return NextResponse.json(
    {
      id: f.id,
      name: f.name,
      description: f.description,
      color: f.color,
      icon: f.icon,
      parentId: f.parent_id,
      path: f.path,
      type: f.type,
      permissions: f.permissions,
      contractCount: 0,
      isActive: f.is_active,
      createdBy: f.created_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    },
    { status: 201, headers: H },
  );
}
