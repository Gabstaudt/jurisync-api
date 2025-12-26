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
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Parte nao encontrada" }, { status: 404, headers: H });
  }
  try {
    const session = await requireAuth(req);
    if (!session || !["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const body = await req.json().catch(() => ({}));
    const fields: string[] = [];
    const values: any[] = [];
    const map: Record<string, string> = {
      name: "name",
      contact: "contact",
      email: "email",
      phone: "phone",
      address: "address",
      notes: "notes",
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
      `UPDATE parties SET ${fields.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length}
       RETURNING *`,
      values,
    );
    const p = rows[0];
    if (!p) {
      return NextResponse.json({ error: "Parte nao encontrada" }, { status: 404, headers: H });
    }
    return NextResponse.json(
      {
        id: p.id,
        name: p.name,
        contact: p.contact,
        email: p.email,
        phone: p.phone,
        address: p.address,
        notes: p.notes,
        ecosystemId: p.ecosystem_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
      { headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Parte nao encontrada" }, { status: 404, headers: H });
  }
  try {
    const session = await requireAuth(req);
    if (!session || !["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const { rowCount } = await q(
      `DELETE FROM parties WHERE id = $1 AND ecosystem_id = $2`,
      [params.id, session.user.ecosystemId],
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Parte nao encontrada" }, { status: 404, headers: H });
    }
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
