import { NextResponse } from "next/server";
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { rows } = await q(
    "SELECT * FROM contract_history WHERE contract_id = $1 ORDER BY timestamp DESC",
    [params.id],
  );

  const data = (rows as any[]).map((h) => ({
    id: h.id,
    contractId: h.contract_id,
    action: h.action,
    field: h.field,
    oldValue: h.old_value,
    newValue: h.new_value,
    authorId: h.author_id,
    author: h.author_name,
    metadata: h.metadata,
    timestamp: h.timestamp,
  }));

  return NextResponse.json(data, { headers: H });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }

  const body = await req.json().catch(() => ({}));
  const action = (body.action || "").trim();
  if (!action) {
    return NextResponse.json(
      { error: "Ação é obrigatória" },
      { status: 400, headers: H },
    );
  }

  const { rows } = await q(
    `INSERT INTO contract_history
      (contract_id, action, field, old_value, new_value, author_id, author_name, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      params.id,
      action,
      body.field || null,
      body.oldValue || null,
      body.newValue || null,
      session.user.id,
      session.user.name,
      body.metadata || null,
    ],
  );

  const h = rows[0];
  return NextResponse.json(
    {
      id: h.id,
      contractId: h.contract_id,
      action: h.action,
      field: h.field,
      oldValue: h.old_value,
      newValue: h.new_value,
      authorId: h.author_id,
      author: h.author_name,
      metadata: h.metadata,
      timestamp: h.timestamp,
    },
    { status: 201, headers: H },
  );
}
