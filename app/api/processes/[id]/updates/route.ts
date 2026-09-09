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

const mapUpdate = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  content: r.content,
  createdBy: r.created_by,
  createdByName: r.created_by_name,
  createdAt: r.created_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    `SELECT pu.*, u.name AS created_by_name
     FROM process_updates pu
     LEFT JOIN users u ON u.id = pu.created_by
     WHERE pu.process_id = $1 AND pu.ecosystem_id = $2
     ORDER BY pu.created_at DESC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapUpdate), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const content = (body?.content || "").trim();
  if (!content) {
    return NextResponse.json({ error: "Conteudo obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO process_updates (process_id, ecosystem_id, content, created_by)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [id, session.user.ecosystemId, content, session.user.id],
  );

  return NextResponse.json(mapUpdate({ ...rows[0], created_by_name: session.user.name }), {
    status: 201,
    headers: H,
  });
}
