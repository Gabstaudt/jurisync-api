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

const STATUS = ["pendente", "cumprido", "perdido"] as const;

const mapDeadline = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  title: r.title,
  dueDate: r.due_date,
  status: r.status,
  notes: r.notes,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
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
    `SELECT * FROM process_deadlines
     WHERE process_id = $1 AND ecosystem_id = $2
     ORDER BY due_date ASC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapDeadline), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title || "").trim();
  const dueDate = body?.dueDate;
  const notes = body?.notes || null;
  const status = body?.status || "pendente";

  if (!title) {
    return NextResponse.json({ error: "Titulo do prazo obrigatorio" }, { status: 400, headers: H });
  }
  if (!dueDate) {
    return NextResponse.json({ error: "Data do prazo obrigatoria" }, { status: 400, headers: H });
  }
  if (!STATUS.includes(status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO process_deadlines (process_id, ecosystem_id, title, due_date, status, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [id, session.user.ecosystemId, title, new Date(dueDate), status, notes, session.user.id],
  );

  return NextResponse.json(mapDeadline(rows[0]), { status: 201, headers: H });
}
