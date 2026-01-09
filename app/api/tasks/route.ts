import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";
import { fetchTaskWithAssignees, mapTask, syncAssignees, TASK_PRIORITY, TASK_STATUS, validateLinks } from "./helpers";

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
      ) AS assignees
     FROM tasks t
     LEFT JOIN task_assignees ta ON ta.task_id = t.id
     LEFT JOIN users u ON u.id = ta.user_id
     WHERE t.ecosystem_id = $1
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapTask), { headers: H });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json();
  const {
    title,
    description = null,
    status = "pendente",
    priority = "media",
    dueDate = null,
    tags = [],
    folderId = null,
    contractId = null,
    assignees,
  } = body || {};

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400, headers: H });
  }
  if (!TASK_STATUS.includes(status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400, headers: H });
  }
  if (!TASK_PRIORITY.includes(priority)) {
    return NextResponse.json({ error: "Prioridade invalida" }, { status: 400, headers: H });
  }

  const linkError = await validateLinks(folderId, contractId, session.user.ecosystemId);
  if (linkError) {
    return NextResponse.json({ error: linkError }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO tasks (title, description, status, priority, due_date, tags, folder_id, contract_id, ecosystem_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      title,
      description,
      status,
      priority,
      dueDate ? new Date(dueDate) : null,
      Array.isArray(tags) ? tags : [],
      folderId,
      contractId,
      session.user.ecosystemId,
      session.user.id,
    ],
  );

  const task = rows[0];
  await syncAssignees(task.id, assignees, session.user.ecosystemId);
  const fullTask = await fetchTaskWithAssignees(task.id, session.user.ecosystemId);

  return NextResponse.json(fullTask, { status: 201, headers: H });
}
