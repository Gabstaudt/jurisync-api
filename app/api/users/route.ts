import crypto from "crypto";
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { hashPassword, requireAuth, sanitizeUser } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

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

export async function GET(req: Request) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: withCors(req) },
    );
  }

  const { rows } = await q(
    "SELECT * FROM users WHERE ecosystem_id = $1 ORDER BY created_at DESC",
    [session.user.ecosystemId],
  );

  return NextResponse.json(rows.map((r) => sanitizeUser(r as any)), { headers: withCors(req) });
}

export async function POST(req: Request) {
  const session = await requireAuth(req);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: withCors(req) },
    );
  }

  const body = await req.json().catch(() => ({}));
  const name = (body.name || "").trim();
  const email = (body.email || "").toLowerCase().trim();
  const role = body.role || "user";
  const department = body.department || null;
  const phone = body.phone || null;

  if (!name || !email) {
    return NextResponse.json(
      { error: "Nome e e-mail são obrigatórios" },
      { status: 400, headers: withCors(req) },
    );
  }
  if (!["admin", "manager", "user"].includes(role)) {
    return NextResponse.json(
      { error: "Cargo inválido" },
      { status: 400, headers: withCors(req) },
    );
  }

  const existing = await q(
    "SELECT id FROM users WHERE email = $1 AND ecosystem_id = $2 LIMIT 1",
    [email, session.user.ecosystemId],
  );
  if (existing.rows[0]) {
    return NextResponse.json(
      { error: "E-mail já cadastrado neste ecossistema" },
      { status: 409, headers: withCors(req) },
    );
  }

  const generatedPassword = crypto.randomBytes(6).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12);
  const passwordHash = await hashPassword(generatedPassword);
  const activationToken = crypto.randomBytes(24).toString("hex");
  const { rows } = await q(
    `INSERT INTO users (name, email, password_hash, role, department, phone, invite_code, ecosystem_id, email_verified, email_verification_token, is_active, is_pending, activation_token)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      name,
      email,
      passwordHash,
      role,
      department,
      phone,
      body.inviteCode || null,
      session.user.ecosystemId,
      false, // email_verified
      null, // email_verification_token
      false, // is_active
      true, // is_pending
      activationToken,
    ],
  );

  const created = rows[0];

  try {
    const baseUrl =
      process.env.API_URL ||
      process.env.APP_URL ||
      new URL(req.url).origin ||
      "http://localhost:3000";
    const activationUrl = `${baseUrl.replace(/\/$/, "")}/api/users/activate?token=${activationToken}`;
    await sendMail({
      to: email,
      subject: "JuriSync - seu acesso foi criado",
      text: `Olá ${name},\n\nUm administrador criou seu acesso ao JuriSync.\n\nLogin: ${email}\nSenha temporária: ${generatedPassword}\n\nPara ativar sua conta, acesse:\n${activationUrl}\n\nApós ativar, recomendamos alterar sua senha nas configurações de perfil.`,
      html: `<p>Olá ${name},</p><p>Um administrador criou seu acesso ao JuriSync.</p><p><strong>Login:</strong> ${email}<br/><strong>Senha temporária:</strong> ${generatedPassword}</p><p>Para ativar sua conta, acesse o link:</p><p><a href="${activationUrl}">${activationUrl}</a></p><p>Após ativar, recomendamos alterar sua senha nas configurações de perfil.</p>`,
    });
  } catch (mailErr) {
    console.warn("Falha ao enviar email de boas-vindas:", mailErr);
  }

  return NextResponse.json(sanitizeUser(created as any), {
    status: 201,
    headers: withCors(req),
  });
}
