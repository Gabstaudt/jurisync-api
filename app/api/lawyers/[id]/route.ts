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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const { name, oab, userId } = body || {};

  if (userId) {
    const { rows: userCheck } = await q(
      "SELECT id FROM users WHERE id = $1 AND ecosystem_id = $2",
      [userId, session.user.ecosystemId],
    );
    if (!userCheck.length) {
      return NextResponse.json({ error: "Usuario nao encontrado no ecossistema" }, { status: 404, headers: H });
    }
  }

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(name);
  }
  if (oab !== undefined) {
    updates.push(`oab = $${idx++}`);
    values.push(oab || null);
  }
  if (userId !== undefined) {
    updates.push(`user_id = $${idx++}`);
    values.push(userId || null);
  }
  updates.push(`updated_at = NOW()`);

  values.push(id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE lawyers SET ${updates.join(", ")}
     WHERE id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Advogado nao encontrado" }, { status: 404, headers: H });
  }

  const updated = rows[0];
  let userName: string | null = null;
  if (updated.user_id) {
    const { rows: u } = await q("SELECT name FROM users WHERE id = $1", [updated.user_id]);
    userName = u[0]?.name || null;
  }

  return NextResponse.json(mapLawyer({ ...updated, user_name: userName }), { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q(
    "DELETE FROM lawyers WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: "Advogado nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
