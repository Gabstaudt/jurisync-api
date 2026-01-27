import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { H, mapTemplate, mapHistory, requireSession } from "../helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status: 401, headers: H });
  }
  const { id } = params || {};
  const { rows: templateRows } = await q(
    `SELECT ct.*, u.name AS created_by_name
     FROM contract_templates ct
     LEFT JOIN users u ON u.id = ct.created_by
     WHERE ct.id = $1 AND ct.ecosystem_id = $2 AND ct.is_active = TRUE`,
    [id, session.user.ecosystemId],
  );
  if (!templateRows.length) {
    return NextResponse.json({ error: "Modelo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: historyRows } = await q(
    `SELECT h.*, u.name AS created_by_name
     FROM contract_template_history h
     LEFT JOIN users u ON u.id = h.created_by
     WHERE h.template_id = $1
     ORDER BY h.created_at DESC`,
    [id],
  );

  return NextResponse.json(
    { template: mapTemplate(templateRows[0]), history: historyRows.map(mapHistory) },
    { headers: H },
  );
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status: 401, headers: H });
  }
  const { id } = params || {};
  const body = await req.json();
  const { name, description, filePath, fileName, fileType, fileSize } = body || {};

  const { rows } = await q(
    `
    UPDATE contract_templates
    SET
      name = COALESCE($1, name),
      description = COALESCE($2, description),
      file_path = COALESCE($3, file_path),
      file_name = COALESCE($4, file_name),
      file_type = COALESCE($5, file_type),
      file_size = COALESCE($6, file_size),
      updated_at = NOW()
    WHERE id = $7 AND ecosystem_id = $8 AND is_active = TRUE
    RETURNING *, (SELECT name FROM users WHERE id = created_by) AS created_by_name
    `,
    [name, description, filePath, fileName, fileType, fileSize, id, session.user.ecosystemId],
  );

  if (!rows.length) {
    return NextResponse.json({ error: "Modelo nao encontrado" }, { status: 404, headers: H });
  }

  const changed: Record<string, any> = {};
  if (name !== undefined) changed.name = name;
  if (description !== undefined) changed.description = description;
  if (filePath !== undefined) changed.filePath = filePath;
  if (fileName !== undefined) changed.fileName = fileName;
  if (fileType !== undefined) changed.fileType = fileType;
  if (fileSize !== undefined) changed.fileSize = fileSize;

  if (Object.keys(changed).length) {
    await q(
      `INSERT INTO contract_template_history (template_id, action, changed_fields, created_by)
       VALUES ($1,'update',$2,$3)`,
      [id, changed, session.user.id],
    );
  }

  return NextResponse.json(mapTemplate(rows[0]), { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status: 401, headers: H });
  }
  const { id } = params || {};
  const { rowCount } = await q(
    `UPDATE contract_templates SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND ecosystem_id = $2`,
    [id, session.user.ecosystemId],
  );
  if (!rowCount) {
    return NextResponse.json({ error: "Modelo nao encontrado" }, { status: 404, headers: H });
  }
  await q(
    `INSERT INTO contract_template_history (template_id, action, changed_fields, created_by)
     VALUES ($1,'delete', NULL, $2)`,
    [id, session.user.id],
  );
  return NextResponse.json({ ok: true }, { headers: H });
}
