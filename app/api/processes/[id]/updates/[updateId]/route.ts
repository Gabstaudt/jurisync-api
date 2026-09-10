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

const mapUpdate = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  content: r.content,
  attachments: r.attachments || [],
  createdBy: r.created_by,
  createdByName: r.created_by_name,
  createdAt: r.created_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const { id, updateId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const { content, attachments } = body || {};

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (content !== undefined) {
    const trimmed = (content || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "Conteudo obrigatorio" }, { status: 400, headers: H });
    }
    updates.push(`content = $${idx++}`);
    values.push(trimmed);
  }
  if (attachments !== undefined) {
    updates.push(`attachments = $${idx++}`);
    values.push(JSON.stringify(Array.isArray(attachments) ? attachments : []));
  }
  if (!updates.length) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400, headers: H });
  }

  values.push(updateId, id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE process_updates SET ${updates.join(", ")}
     WHERE id = $${idx++} AND process_id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Registro nao encontrado" }, { status: 404, headers: H });
  }

  let createdByName: string | null = null;
  if (rows[0].created_by) {
    const { rows: u } = await q("SELECT name FROM users WHERE id = $1", [rows[0].created_by]);
    createdByName = u[0]?.name || null;
  }

  return NextResponse.json(mapUpdate({ ...rows[0], created_by_name: createdByName }), { headers: H });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const { id, updateId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q(
    "DELETE FROM process_updates WHERE id = $1 AND process_id = $2 AND ecosystem_id = $3",
    [updateId, id, session.user.ecosystemId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: "Registro nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
