import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { sanitizeUser } from "@/lib/auth";

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

async function activateByToken(token: string) {
  if (!token) {
    return NextResponse.json({ error: "Token obrigatorio" }, { status: 400, headers: H });
  }

  const { rows } = await q(
    `UPDATE users
        SET is_active = TRUE,
            is_pending = FALSE,
            email_verified = TRUE,
            activation_token = NULL,
            updated_at = NOW()
      WHERE activation_token = $1
      RETURNING *`,
    [token],
  );

  const user = rows[0];
  if (!user) {
    return NextResponse.json({ error: "Token invalido ou expirado" }, { status: 400, headers: H });
  }

  return NextResponse.json({ user: sanitizeUser(user as any) }, { headers: H });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const url = new URL(req.url);
  const token = (body.token || url.searchParams.get("token") || "").toString().trim();
  return activateByToken(token);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").toString().trim();
  return activateByToken(token);
}
