import crypto from "crypto";
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { hashPassword, requireAuth, sanitizeUser } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

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

export async function GET(req: Request) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }

  const { rows } = await q(
    "SELECT * FROM users WHERE ecosystem_id = $1 ORDER BY created_at DESC",
    [session.user.ecosystemId],
  );

  return NextResponse.json(rows.map((r) => sanitizeUser(r as any)), { headers: H });
}

export async function POST(req: Request) {
  const session = await requireAuth(req);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: H },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const role = body.role || "user";
  const password = body.password || "changeme123";
  const department = body.department || null;
  const phone = body.phone || null;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Nome e e-mail são obrigatórios" },
      { status: 400, headers: H },
    );
  }
  if (!["admin", "manager", "user"].includes(role)) {
    return NextResponse.json(
      { error: "Cargo inválido" },
      { status: 400, headers: H },
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = crypto.randomBytes(24).toString("hex");
  const { rows } = await q(
    `INSERT INTO users (name, email, password_hash, role, department, phone, invite_code, ecosystem_id, email_verified, email_verification_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      name,
      email,
      passwordHash,
      role,
      department,
      phone,
      body.inviteCode || null,
      session.user.ecosystemId,
      false,
      verificationToken,
    ],
  );

  const created = rows[0];

  try {
    const confirmUrl = `${process.env.APP_URL || "http://localhost:3000"}/api/auth/confirm?token=${verificationToken}`;
    await sendMail({
      to: email,
      subject: "Bem-vindo ao JuriSync - confirme seu email",
      text: `Olá ${name},\n\nBem-vindo ao JuriSync! Clique no link para confirmar seu email:\n${confirmUrl}\n\nSe não reconhece esta conta, ignore este email.`,
      html: `<p>Olá ${name},</p><p>Bem-vindo ao JuriSync!</p><p>Clique para confirmar seu email:</p><p><a href="${confirmUrl}">${confirmUrl}</a></p><p>Se não reconhece esta conta, ignore este email.</p>`,
    });
  } catch (mailErr) {
    console.warn("Falha ao enviar email de boas-vindas:", mailErr);
  }

  return NextResponse.json(sanitizeUser(created as any), {
    status: 201,
    headers: H,
  });
}
