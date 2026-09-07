import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const mapLawyer = (r: any) => ({
  id: r.id,
  name: r.name,
  oab: r.oab,
  userId: r.user_id,
  userName: r.user_name,
  ecosystemId: r.ecosystem_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const { rows } = await q(
    `SELECT l.*, u.name AS user_name
     FROM lawyers l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.ecosystem_id = $1
     ORDER BY l.name ASC`,
    [session.user.ecosystemId],
  );
  return NextResponse.json(rows.map(mapLawyer), { headers: H });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const name = (body?.name || "").trim();
  const oab = (body?.oab || "").trim() || null;
  const userId = body?.userId || null;

  if (!name) {
    return NextResponse.json({ error: "Nome do advogado obrigatorio" }, { status: 400, headers: H });
  }

  if (userId) {
    const { rows: userCheck } = await q(
      "SELECT id FROM users WHERE id = $1 AND ecosystem_id = $2",
      [userId, session.user.ecosystemId],
    );
    if (!userCheck.length) {
      return NextResponse.json({ error: "Usuario nao encontrado no ecossistema" }, { status: 404, headers: H });
    }
  }

  const { rows } = await q(
    `INSERT INTO lawyers (ecosystem_id, name, oab, user_id, created_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [session.user.ecosystemId, name, oab, userId, session.user.id],
  );

  const created = rows[0];
  let userName: string | null = null;
  if (created.user_id) {
    const { rows: u } = await q("SELECT name FROM users WHERE id = $1", [created.user_id]);
    userName = u[0]?.name || null;
  }

  return NextResponse.json(mapLawyer({ ...created, user_name: userName }), { status: 201, headers: H });
}
