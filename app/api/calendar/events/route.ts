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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope") === "individual" ? "individual" : "ecosystem";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Parametros from e to obrigatorios" }, { status: 400, headers: H });
  }

  const userId = session.user.id;
  const ecosystemId = session.user.ecosystemId;

  const { rows: eventRows } = await q(
    `SELECT e.*, COALESCE(array_agg(ep.user_id) FILTER (WHERE ep.user_id IS NOT NULL), '{}') AS participant_ids
     FROM calendar_events e
     LEFT JOIN calendar_event_participants ep ON ep.event_id = e.id
     WHERE e.ecosystem_id = $1 AND e.start_at >= $2 AND e.start_at <= $3
     GROUP BY e.id
     ORDER BY e.start_at ASC`,
    [ecosystemId, from, to],
  );

  const events = eventRows
    .filter((e: any) => {
      const isPublic = e.participant_ids.length === 0;
      const involvesMe = e.created_by === userId || e.participant_ids.includes(userId);
      if (scope === "individual") return involvesMe;
      return isPublic || involvesMe;
    })
    .map((e: any) => ({
      id: e.id,
      kind: "event",
      title: e.title,
      description: e.description,
      startAt: e.start_at,
      endAt: e.end_at,
      allDay: e.all_day,
      createdBy: e.created_by,
      participantIds: e.participant_ids,
    }));

  const { rows: taskRows } = await q(
    `SELECT t.*, COALESCE(array_agg(ta.user_id) FILTER (WHERE ta.user_id IS NOT NULL), '{}') AS assignee_ids
     FROM tasks t
     LEFT JOIN task_assignees ta ON ta.task_id = t.id
     WHERE t.ecosystem_id = $1 AND t.due_date IS NOT NULL
       AND t.due_date >= $2 AND t.due_date <= $3
     GROUP BY t.id
     ORDER BY t.due_date ASC`,
    [ecosystemId, from, to],
  );

  const tasks = taskRows
    .filter((t: any) => {
      if (scope === "individual") {
        return t.created_by === userId || t.assignee_ids.includes(userId);
      }
      return true;
    })
    .map((t: any) => ({
      id: t.id,
      kind: "task",
      title: t.title,
      description: t.description,
      startAt: t.due_date,
      endAt: null,
      allDay: true,
      createdBy: t.created_by,
      assigneeIds: t.assignee_ids,
      status: t.status,
    }));

  return NextResponse.json([...events, ...tasks], { headers: H });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const title = (body?.title || "").trim();
  const description = (body?.description || "").trim() || null;
  const startAt = body?.startAt;
  const endAt = body?.endAt || null;
  const allDay = Boolean(body?.allDay);
  const participantIds: string[] = Array.isArray(body?.participantIds) ? body.participantIds : [];

  if (!title) {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400, headers: H });
  }
  if (!startAt) {
    return NextResponse.json({ error: "Data de inicio obrigatoria" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO calendar_events (ecosystem_id, title, description, start_at, end_at, all_day, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [session.user.ecosystemId, title, description, new Date(startAt), endAt ? new Date(endAt) : null, allDay, session.user.id],
  );

  const event = rows[0];

  if (participantIds.length) {
    const values: any[] = [];
    const placeholders = participantIds
      .map((uid, idx) => {
        values.push(event.id, uid);
        return `($${idx * 2 + 1}, $${idx * 2 + 2})`;
      })
      .join(",");
    await q(
      `INSERT INTO calendar_event_participants (event_id, user_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
      values,
    );
  }

  return NextResponse.json(
    {
      id: event.id,
      kind: "event",
      title: event.title,
      description: event.description,
      startAt: event.start_at,
      endAt: event.end_at,
      allDay: event.all_day,
      createdBy: event.created_by,
      participantIds,
    },
    { status: 201, headers: H },
  );
}
