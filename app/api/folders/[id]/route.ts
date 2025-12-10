import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { rows } = await q(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM contracts c WHERE c.folder_id = f.id) AS contract_count_calc
     FROM folders f WHERE f.id = $1`,
    [params.id],
  );
  const f = rows[0] as any;
  if (!f) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404, headers: H });
  }
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
      contractCount: Number(f.contract_count_calc ?? f.contract_count ?? 0),
      isActive: f.is_active,
      createdBy: f.created_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    },
    { headers: H },
  );
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session || !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];

  const mapping: Record<string, string> = {
    name: "name",
    description: "description",
    color: "color",
    icon: "icon",
    parentId: "parent_id",
    path: "path",
    permissions: "permissions",
    isActive: "is_active",
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (body[key] !== undefined) {
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(body[key]);
    }
  });

  if (!fields.length) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400, headers: H });
  }

  values.push(params.id);
  const { rows } = await q(
    `UPDATE folders SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${
      values.length
    } RETURNING *`,
    values,
  );
  const f = rows[0] as any;
  if (!f) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404, headers: H });
  }

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
      contractCount: Number(f.contract_count ?? 0),
      isActive: f.is_active,
      createdBy: f.created_by,
      createdAt: f.created_at,
      updatedAt: f.updated_at,
    },
    { headers: H },
  );
}
