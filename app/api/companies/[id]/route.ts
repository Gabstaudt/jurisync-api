import { NextRequest, NextResponse } from "next/server";
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

export async function PATCH(req: NextRequest, context: any) {
  try {
    const params = (context?.params || {}) as { id?: string };
    if (!params.id) {
      return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404, headers: H });
    }
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
      cnpj: "cnpj",
      email: "email",
      phone: "phone",
    };
    Object.entries(map).forEach(([k, col]) => {
      if (body[k] !== undefined) {
        fields.push(`${col} = $${fields.length + 1}`);
        values.push(body[k] === "" ? null : body[k]);
      }
    });
    if (!fields.length) {
      return NextResponse.json({ error: "Nada para atualizar" }, { status: 400, headers: H });
    }
    values.push(params.id, session.user.ecosystemId);
    const { rows } = await q(
      `UPDATE companies SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length}
       RETURNING *`,
      values,
    );
    const c = rows[0];
    if (!c) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404, headers: H });
    }
    return NextResponse.json(
      {
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        phone: c.phone,
        ecosystemId: c.ecosystem_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      },
      { headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const params = (context?.params || {}) as { id?: string };
    if (!params.id) {
      return NextResponse.json({ error: "Empresa nao encontrada" }, { status: 404, headers: H });
    }
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    if (!["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const { rowCount } = await q(
      `DELETE FROM companies WHERE id = $1 AND ecosystem_id = $2`,
      [params.id, session.user.ecosystemId],
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Empresa não encontrada" }, { status: 404, headers: H });
    }
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
