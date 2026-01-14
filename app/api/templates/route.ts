import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { H, mapTemplate, mapHistory, requireSession } from "./helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status: 401, headers: H });
  }

  const search = new URL(req.url).searchParams.get("q");
  const term = search ? `%${search.toLowerCase()}%` : null;

  const { rows } = await q(
    `
    SELECT ct.*, u.name AS created_by_name
    FROM contract_templates
    LEFT JOIN users u ON u.id = ct.created_by
    WHERE ecosystem_id = $1
      AND is_active = TRUE
      AND ($2::text IS NULL OR lower(name) LIKE $2 OR lower(COALESCE(description,'')) LIKE $2)
    ORDER BY created_at DESC
    `,
    [session.user.ecosystemId, term],
  );

  return NextResponse.json(rows.map(mapTemplate), { headers: H });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession(req);
  if (!session) {
    return NextResponse.json({ error }, { status: 401, headers: H });
  }

  const body = await req.json();
  const { name, description = null, filePath, fileName, fileType = null, fileSize = null } = body || {};

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400, headers: H });
  }
  if (!filePath || typeof filePath !== "string" || !fileName) {
    return NextResponse.json({ error: "Arquivo obrigatorio" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `
    INSERT INTO contract_templates (name, description, file_path, file_name, file_type, file_size, ecosystem_id, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *
    `,
    [name, description, filePath, fileName, fileType, fileSize, session.user.ecosystemId, session.user.id],
  );

  const created = rows[0];

  await q(
    `INSERT INTO contract_template_history (template_id, action, changed_fields, created_by)
     VALUES ($1,'create',$2,$3)`,
    [
      created.id,
      {
        name,
        description,
        filePath,
        fileName,
        fileType,
        fileSize,
      },
      session.user.id,
    ],
  );

  const mapped = mapTemplate({ ...created, created_by_name: session.user.name });
  return NextResponse.json(mapped, { status: 201, headers: H });
}
