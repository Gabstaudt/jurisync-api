import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";
import { fetchTeamWithMembers, mapTeam, syncMembers } from "./helpers";

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

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    `SELECT t.*,
      COALESCE(
        JSON_AGG(DISTINCT JSONB_BUILD_OBJECT('id', u.id, 'name', u.name, 'email', u.email))
        FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS members
     FROM teams t
     LEFT JOIN team_members tm ON tm.team_id = t.id
     LEFT JOIN users u ON u.id = tm.user_id
     WHERE t.ecosystem_id = $1
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapTeam), { headers: H });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  if (!["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json();
  const { name, description = null, members = [] } = body || {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO teams (name, description, ecosystem_id, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name.trim(), description || null, session.user.ecosystemId, session.user.id],
  );

  const team = rows[0];
  await syncMembers(team.id, members, session.user.ecosystemId);
  const full = await fetchTeamWithMembers(team.id, session.user.ecosystemId);

  return NextResponse.json(full, { status: 201, headers: H });
}
