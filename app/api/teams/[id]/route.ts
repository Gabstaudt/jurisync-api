import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";
import { fetchTeamWithMembers, mapTeam, syncMembers } from "../helpers";

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const team = await fetchTeamWithMembers(params.id, session.user.ecosystemId);
  if (!team) {
    return NextResponse.json({ error: "Equipe nao encontrada" }, { status: 404, headers: H });
  }
  return NextResponse.json(team, { headers: H });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  if (!["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json();
  const { name, members } = body || {};

  const updates: string[] = [];
  const paramsList: any[] = [];
  let idx = 1;

  if (name !== undefined) {
    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400, headers: H });
    }
    updates.push(`name = $${idx++}`);
    paramsList.push(name.trim());
  }

  updates.push(`updated_at = NOW()`);
  paramsList.push(params.id, session.user.ecosystemId);

  const { rows } = await q(
    `UPDATE teams SET ${updates.join(", ")}
     WHERE id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    paramsList,
  );

  const updated = rows[0];
  if (!updated) {
    return NextResponse.json({ error: "Equipe nao encontrada" }, { status: 404, headers: H });
  }

  await syncMembers(updated.id, members, session.user.ecosystemId);
  const full = await fetchTeamWithMembers(updated.id, session.user.ecosystemId);
  return NextResponse.json(full, { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  if (!["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const { rowCount } = await q("DELETE FROM teams WHERE id = $1 AND ecosystem_id = $2", [
    params.id,
    session.user.ecosystemId,
  ]);
  if (!rowCount) {
    return NextResponse.json({ error: "Equipe nao encontrada" }, { status: 404, headers: H });
  }
  return NextResponse.json({ ok: true }, { headers: H });
}
