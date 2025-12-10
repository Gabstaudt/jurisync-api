import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { createSession, hashPassword, sanitizeUser } from "@/lib/auth";

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
    const name = (body.name || "").trim();
    const email = (body.email || "").toLowerCase().trim();
    const password = body.password || "";
    const inviteCode = (body.inviteCode || "").trim();
    const department = body.department || null;
    const phone = body.phone || null;

    if (!name || !email || !password || !inviteCode) {
      return NextResponse.json(
        { error: "Nome, e-mail, senha e código de convite são obrigatórios" },
        { status: 400, headers: H },
      );
    }

    const { rows: inviteRows } = await q(
      "SELECT * FROM invite_codes WHERE code = $1 AND is_active = TRUE",
      [inviteCode],
    );
    const invite = inviteRows[0] as any;
    if (!invite) {
      return NextResponse.json(
        { error: "Código de convite inválido" },
        { status: 400, headers: H },
      );
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Código de convite expirado" },
        { status: 400, headers: H },
      );
    }
    if (invite.email && invite.email.toLowerCase() !== email) {
      return NextResponse.json(
        { error: "Este código está vinculado a outro e-mail" },
        { status: 400, headers: H },
      );
    }

    const { rows: existing } = await q(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );
    if (existing[0]) {
      return NextResponse.json(
        { error: "E-mail já cadastrado" },
        { status: 409, headers: H },
      );
    }

    const passwordHash = await hashPassword(password);
    const { rows: created } = await q(
      `INSERT INTO users (name, email, password_hash, role, department, phone, invite_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        name,
        email,
        passwordHash,
        invite.role || "user",
        department ?? invite.department ?? null,
        phone,
        inviteCode,
      ],
    );
    const userRow = created[0] as any;

    await q(
      "UPDATE invite_codes SET used_at = NOW(), used_by = $1, is_active = FALSE WHERE id = $2",
      [userRow.id, invite.id],
    );

    const session = await createSession(userRow.id);

    return NextResponse.json(
      { token: session.token, user: sanitizeUser(userRow) },
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro interno" },
      { status: 500, headers: H },
    );
  }
}
