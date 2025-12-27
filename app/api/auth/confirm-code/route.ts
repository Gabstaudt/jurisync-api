import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// Confirma email usando o código enviado por email (usuário autenticado)
export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const code = (body.code || "").toString().trim();
  if (!code) {
    return NextResponse.json({ error: "Codigo obrigatorio" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `UPDATE users
       SET email_verified = TRUE,
           email_verification_token = NULL,
           updated_at = NOW()
     WHERE id = $1 AND email_verification_token = $2
     RETURNING id`,
    [session.user.id, code],
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Codigo invalido" }, { status: 400, headers: H });
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: H });
}
