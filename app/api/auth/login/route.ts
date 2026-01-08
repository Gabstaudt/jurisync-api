import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import {
  createSession,
  getUserByEmail,
  sanitizeUser,
  touchLastLogin,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

const withCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 200, headers: withCors(req) });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = (body.email || "").toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json({ error: "E-mail e senha são obrigatórios" }, { status: 400, headers: withCors(req) });
    }

    const userRow = await getUserByEmail(email);
    if (!userRow) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401, headers: withCors(req) });
    }

    const ok = await verifyPassword(password, userRow.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401, headers: withCors(req) });
    }

    let loggedUser = userRow;

    // Se estava pendente, ativa na primeira autenticação bem-sucedida (sem precisar clicar no link)
    if (!userRow.is_active) {
      const { rows: activated } = await q(
        `UPDATE users
            SET is_active = TRUE,
                is_pending = FALSE,
                email_verified = TRUE,
                activation_token = NULL,
                updated_at = NOW()
          WHERE id = $1
          RETURNING *`,
        [userRow.id],
      );
      if (activated[0]) {
        loggedUser = activated[0] as any;
      }
    }

    const session = await createSession(loggedUser.id);
    await touchLastLogin(loggedUser.id);

    return NextResponse.json(
      {
        token: session.token,
        user: sanitizeUser(loggedUser as any),
      },
      { headers: withCors(req) },
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: withCors(req) });
  }
}
