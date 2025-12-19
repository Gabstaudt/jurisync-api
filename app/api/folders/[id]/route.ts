import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    if (!["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const body = await req.json().catch(() => ({}));
    const fields: string[] = [];
    const values: any[] = [];
    const map: Record<string, string> = {
      name: "name",
      description: "description",
      color: "color",
      icon: "icon",
      permissions: "permissions",
      isActive: "is_active",
    };
    Object.entries(map).forEach(([k, col]) => {
      if (body[k] !== undefined) {
        fields.push(`${col} = $${fields.length + 1}`);
        values.push(body[k]);
      }
    });
    if (!fields.length) {
      return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400, headers: H });
    }
    values.push(params.id, session.user.ecosystemId);
    const { rows } = await q(
      `UPDATE folders SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length}
       RETURNING *`,
      values,
    );
    const f = rows[0];
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
        contractCount: Number(f.contract_count ?? 0),
        isActive: f.is_active,
        createdBy: f.created_by,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
      },
      { headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    if (!["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const { rowCount } = await q(
      `DELETE FROM folders WHERE id = $1 AND ecosystem_id = $2`,
      [params.id, session.user.ecosystemId],
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
    }
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const { rows } = await q(
      `SELECT * FROM folders WHERE id = $1 AND ecosystem_id = $2`,
      [params.id, session.user.ecosystemId],
    );
    const f = rows[0];
    if (!f) {
      return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
    }

    const perms = f.permissions || {};
    const isPublic = perms.isPublic ?? true;
    const canView: string[] = perms.canView ?? [];
    const canEdit: string[] = perms.canEdit ?? [];
    const canManage: string[] = perms.canManage ?? [];

    const hasAccess =
      isPublic ||
      ["admin", "manager"].includes(session.user.role) ||
      canView.includes(session.user.id) ||
      canEdit.includes(session.user.id) ||
      canManage.includes(session.user.id);

    if (!hasAccess) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
