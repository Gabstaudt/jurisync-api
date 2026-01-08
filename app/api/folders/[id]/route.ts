import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

const parsePermissions = (value: any) => {
  if (!value || value === "") {
    return { isPublic: true, canView: [], canEdit: [], canManage: [] };
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { isPublic: true, canView: [], canEdit: [], canManage: [] };
    }
  }
  if (typeof value === "object") return value;
  return { isPublic: true, canView: [], canEdit: [], canManage: [] };
};

export async function GET(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }
  const { rows } = await q(
    `SELECT f.*, 
      (SELECT COUNT(*) FROM contracts c WHERE c.folder_id = f.id) AS contract_count_calc
     FROM folders f WHERE f.id = $1 AND f.ecosystem_id = $2`,
    [params.id, session.user.ecosystemId],
  );
  const f = rows[0] as any;
  if (!f) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
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

export async function PATCH(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
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
      if (key === "permissions") {
        values.push(parsePermissions(body[key]));
      } else {
        values.push(body[key]);
      }
    }
  });

  if (!fields.length) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400, headers: H });
  }

  values.push(params.id, session.user.ecosystemId);
  const { rows: currentRows } = await q(
    "SELECT id, type FROM folders WHERE id = $1 AND ecosystem_id = $2",
    [params.id, session.user.ecosystemId],
  );
  const current = currentRows[0] as any;
  if (!current) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
  if (current.type === "system") {
    return NextResponse.json({ error: "Pastas do sistema nao podem ser editadas" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `UPDATE folders SET ${fields.join(
      ", ",
    )}, updated_at = NOW() WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length} RETURNING *`,
    values,
  );
  const f = rows[0] as any;

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

export async function DELETE(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session || !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const { rows: currentRows } = await q(
    "SELECT id, type FROM folders WHERE id = $1 AND ecosystem_id = $2",
    [params.id, session.user.ecosystemId],
  );
  const current = currentRows[0] as any;
  if (!current) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
  if (current.type === "system") {
    return NextResponse.json({ error: "Pastas do sistema nao podem ser excluidas" }, { status: 400, headers: H });
  }

  const { rows: childRows } = await q(
    "SELECT 1 FROM folders WHERE parent_id = $1 AND ecosystem_id = $2 LIMIT 1",
    [params.id, session.user.ecosystemId],
  );
  if (childRows[0]) {
    return NextResponse.json(
      { error: "Nao e possivel excluir pastas que possuem subpastas" },
      { status: 400, headers: H },
    );
  }

  const { rows: contractRows } = await q(
    "SELECT 1 FROM contracts WHERE folder_id = $1 AND ecosystem_id = $2 LIMIT 1",
    [params.id, session.user.ecosystemId],
  );
  if (contractRows[0]) {
    return NextResponse.json(
      { error: "Nao e possivel excluir pastas que possuem contratos" },
      { status: 400, headers: H },
    );
  }

  await q("DELETE FROM folders WHERE id = $1 AND ecosystem_id = $2", [
    params.id,
    session.user.ecosystemId,
  ]);

  return NextResponse.json({ ok: true }, { headers: H });
}
