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

export async function GET(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }
  const { rows } = await q(
    "SELECT * FROM contract_comments WHERE contract_id = $1 ORDER BY created_at DESC",
    [params.id],
  );

  const data = (rows as any[]).map((c) => ({
    id: c.id,
    contractId: c.contract_id,
    authorId: c.author_id,
    author: c.author_name,
    content: c.content,
    isPrivate: c.is_private,
    mentions: c.mentions || [],
    createdAt: c.created_at,
    editedAt: c.edited_at,
  }));

  return NextResponse.json(data, { headers: H });
}

export async function POST(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }

  const body = await req.json().catch(() => ({}));
  const content = (body.content || "").trim();
  if (!content) {
    return NextResponse.json(
      { error: "Comentario e obrigatorio" },
      { status: 400, headers: H },
    );
  }

  const { rows } = await q(
    `INSERT INTO contract_comments
      (contract_id, author_id, author_name, content, is_private, mentions)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      params.id,
      session.user.id,
      session.user.name,
      content,
      body.isPrivate || false,
      body.mentions || [],
    ],
  );

  const c = rows[0];
  return NextResponse.json(
    {
      id: c.id,
      contractId: c.contract_id,
      authorId: c.author_id,
      author: c.author_name,
      content: c.content,
      isPrivate: c.is_private,
      mentions: c.mentions || [],
      createdAt: c.created_at,
      editedAt: c.edited_at,
    },
    { status: 201, headers: H },
  );
}
