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
      `SELECT p.*, c.name AS company_name
       FROM parties p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.ecosystem_id = $1
       ORDER BY p.created_at DESC`,
      [session.user.ecosystemId],
    );
    return NextResponse.json(
      rows.map((p: any) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        email: p.email,
        phone: p.phone,
        companyId: p.company_id,
        companyName: p.company_name,
        ecosystemId: p.ecosystem_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
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
    const body = await req.json().catch(() => ({}));
    const name = (body.name || "").trim();
    const role = (body.role || "").trim();
    if (!name || !role) {
      return NextResponse.json({ error: "Nome e papel são obrigatórios" }, { status: 400, headers: H });
    }
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const companyId = body.companyId || null;

    if (companyId) {
      const { rows: companyCheck } = await q(
        `SELECT id FROM companies WHERE id = $1 AND ecosystem_id = $2`,
        [companyId, session.user.ecosystemId],
      );
      if (!companyCheck[0]) {
        return NextResponse.json({ error: "Empresa não encontrada no ecossistema" }, { status: 404, headers: H });
      }
    }

    const { rows } = await q(
      `INSERT INTO parties (ecosystem_id, company_id, name, role, email, phone, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        session.user.ecosystemId,
        companyId,
        name,
        role,
        email || null,
        phone || null,
        session.user.id,
      ],
    );
    const p = rows[0];
    let companyName: string | null = null;
    if (p.company_id) {
      const { rows: c } = await q("SELECT name FROM companies WHERE id = $1", [p.company_id]);
      companyName = c[0]?.name || null;
    }
    return NextResponse.json(
      {
        id: p.id,
        name: p.name,
        role: p.role,
        email: p.email,
        phone: p.phone,
        companyId: p.company_id,
        companyName,
        ecosystemId: p.ecosystem_id,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      },
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
