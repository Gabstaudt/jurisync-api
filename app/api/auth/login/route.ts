import { NextResponse } from "next/server";
import {
  createSession,
  getUserByEmail,
  sanitizeUser,
  touchLastLogin,
  verifyPassword,
} from "@/lib/auth";

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-mail e senha são obrigatórios" },
        { status: 400, headers: H },
      );
    }

    const userRow = await getUserByEmail(email);
    if (!userRow || !userRow.is_active) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401, headers: H },
      );
    }

    const ok = await verifyPassword(password, userRow.password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Credenciais inválidas" },
        { status: 401, headers: H },
      );
    }

    const session = await createSession(userRow.id);
    await touchLastLogin(userRow.id);

    return NextResponse.json(
      { token: session.token, user: sanitizeUser(userRow) },
      { headers: H },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro interno" },
      { status: 500, headers: H },
    );
  }
}
