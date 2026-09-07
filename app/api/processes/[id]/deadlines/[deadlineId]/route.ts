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

const STATUS = ["pendente", "cumprido", "perdido"] as const;

const mapDeadline = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  title: r.title,
  dueDate: r.due_date,
  status: r.status,
  notes: r.notes,
  attachments: r.attachments || [],
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; deadlineId: string }> }) {
  const { id, deadlineId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const { title, dueDate, status, notes, attachments } = body || {};

  if (status !== undefined && !STATUS.includes(status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400, headers: H });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (title !== undefined) {
    updates.push(`title = $${idx++}`);
    values.push(title);
  }
  if (dueDate !== undefined) {
    updates.push(`due_date = $${idx++}`);
    values.push(new Date(dueDate));
  }
  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    values.push(status);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${idx++}`);
    values.push(notes);
  }
  if (attachments !== undefined) {
    updates.push(`attachments = $${idx++}`);
    values.push(JSON.stringify(Array.isArray(attachments) ? attachments : []));
  }
  updates.push(`updated_at = NOW()`);

  values.push(deadlineId, id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE process_deadlines SET ${updates.join(", ")}
     WHERE id = $${idx++} AND process_id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Prazo nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(mapDeadline(rows[0]), { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; deadlineId: string }> }) {
  const { id, deadlineId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q(
    "DELETE FROM process_deadlines WHERE id = $1 AND process_id = $2 AND ecosystem_id = $3",
    [deadlineId, id, session.user.ecosystemId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: "Prazo nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
