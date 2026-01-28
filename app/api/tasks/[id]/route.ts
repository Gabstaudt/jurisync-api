import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";
import { fetchTaskWithAssignees, syncAssignees, TASK_PRIORITY, TASK_STATUS, validateLinks } from "../helpers";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const task = await fetchTaskWithAssignees(id, session.user.ecosystemId);
  if (!task) {
    return NextResponse.json({ error: "Tarefa nao encontrada" }, { status: 404, headers: H });
  }

  return NextResponse.json(task, { headers: H });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json();
  const { title, description, status, priority, dueDate, tags, folderId, contractId, assignees } = body || {};

  if (status && !TASK_STATUS.includes(status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400, headers: H });
  }
  if (priority && !TASK_PRIORITY.includes(priority)) {
    return NextResponse.json({ error: "Prioridade invalida" }, { status: 400, headers: H });
  }

  const linkError = await validateLinks(folderId, contractId, session.user.ecosystemId);
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 400, headers: H });
  }

  const updates: string[] = [];
  const paramsList: any[] = [];
  let idx = 1;

  if (title !== undefined) {
    updates.push(`title = $${idx++}`);
    paramsList.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    paramsList.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    paramsList.push(status);
  }
  if (priority !== undefined) {
    updates.push(`priority = $${idx++}`);
    paramsList.push(priority);
  }
  if (dueDate !== undefined) {
    updates.push(`due_date = $${idx++}`);
    paramsList.push(dueDate ? new Date(dueDate) : null);
  }
  if (tags !== undefined) {
    updates.push(`tags = $${idx++}`);
    paramsList.push(Array.isArray(tags) ? tags : []);
  }
  if (folderId !== undefined) {
    updates.push(`folder_id = $${idx++}`);
    paramsList.push(folderId);
  }
  if (contractId !== undefined) {
    updates.push(`contract_id = $${idx++}`);
    paramsList.push(contractId);
  }

  updates.push(`updated_at = NOW()`);

  paramsList.push(id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE tasks SET ${updates.join(", ")}
     WHERE id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    paramsList,
  );

  const updated = rows[0];
  if (!updated) {
    return NextResponse.json({ error: "Tarefa nao encontrada" }, { status: 404, headers: H });
  }

  await syncAssignees(updated.id, assignees, session.user.ecosystemId);
  const fullTask = await fetchTaskWithAssignees(updated.id, session.user.ecosystemId);

  return NextResponse.json(fullTask, { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q("DELETE FROM tasks WHERE id = $1 AND ecosystem_id = $2", [
    id,
    session.user.ecosystemId,
  ]);

  if (!rowCount) {
    return NextResponse.json({ error: "Tarefa nao encontrada" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
