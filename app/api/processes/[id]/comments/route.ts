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

const mapComment = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  authorId: r.author_id,
  author: r.author_name,
  content: r.content,
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
    `SELECT * FROM process_comments
     WHERE process_id = $1 AND ecosystem_id = $2
     ORDER BY created_at ASC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapComment), { headers: H });
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
    return NextResponse.json({ error: "Comentario obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO process_comments (process_id, ecosystem_id, author_id, author_name, content)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING *`,
    [id, session.user.ecosystemId, session.user.id, session.user.name, content],
  );

  return NextResponse.json(mapComment(rows[0]), { status: 201, headers: H });
}
