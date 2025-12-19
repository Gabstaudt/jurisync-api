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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    const { rows } = await q(
      `SELECT * FROM companies WHERE ecosystem_id = $1 ORDER BY created_at DESC`,
      [session.user.ecosystemId],
    );
    return NextResponse.json(
      rows.map((c: any) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        phone: c.phone,
        ecosystemId: c.ecosystem_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
      { headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    if (!["admin", "manager"].includes(session.user.role)) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
    }
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400, headers: H });
    }
    const cnpj = (body.cnpj || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();

    const { rows } = await q(
      `INSERT INTO companies (ecosystem_id, name, cnpj, email, phone, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [session.user.ecosystemId, name, cnpj || null, email || null, phone || null, session.user.id],
    );
    const c = rows[0];
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
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
