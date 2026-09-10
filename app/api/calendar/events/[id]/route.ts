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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows: existingRows } = await q(
    "SELECT * FROM calendar_events WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "Evento nao encontrado" }, { status: 404, headers: H });
  }
  if (existing.created_by !== session.user.id && !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const { title, description, startAt, endAt, allDay, participantIds } = body || {};

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (title !== undefined) {
    updates.push(`title = $${idx++}`);
    values.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    values.push(description || null);
  }
  if (startAt !== undefined) {
    updates.push(`start_at = $${idx++}`);
    values.push(new Date(startAt));
  }
  if (endAt !== undefined) {
    updates.push(`end_at = $${idx++}`);
    values.push(endAt ? new Date(endAt) : null);
  }
  if (allDay !== undefined) {
    updates.push(`all_day = $${idx++}`);
    values.push(Boolean(allDay));
  }
  updates.push(`updated_at = NOW()`);

  values.push(id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE calendar_events SET ${updates.join(", ")}
     WHERE id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    values,
  );
  const updated = rows[0];

  if (Array.isArray(participantIds)) {
    await q("DELETE FROM calendar_event_participants WHERE event_id = $1", [id]);
    if (participantIds.length) {
      const vals: any[] = [];
      const placeholders = participantIds
        .map((uid: string, i: number) => {
          vals.push(id, uid);
          return `($${i * 2 + 1}, $${i * 2 + 2})`;
        })
        .join(",");
      await q(
        `INSERT INTO calendar_event_participants (event_id, user_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        vals,
      );
    }
  }

  const { rows: participantRows } = await q(
    "SELECT user_id FROM calendar_event_participants WHERE event_id = $1",
    [id],
  );

  return NextResponse.json(
    {
      id: updated.id,
      kind: "event",
      title: updated.title,
      description: updated.description,
      startAt: updated.start_at,
      endAt: updated.end_at,
      allDay: updated.all_day,
      createdBy: updated.created_by,
      participantIds: participantRows.map((r: any) => r.user_id),
    },
    { headers: H },
  );
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows: existingRows } = await q(
    "SELECT created_by FROM calendar_events WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json({ error: "Evento nao encontrado" }, { status: 404, headers: H });
  }
  if (existing.created_by !== session.user.id && !["admin", "manager"].includes(session.user.role)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  await q("DELETE FROM calendar_events WHERE id = $1 AND ecosystem_id = $2", [id, session.user.ecosystemId]);

  return NextResponse.json({ ok: true }, { headers: H });
}
