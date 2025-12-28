import crypto from "crypto";
import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { createSession, hashPassword, sanitizeUser } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";

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
    const role = body.role || "user";
    const accessCode = (body.inviteCode || body.accessCode || "").trim();
    const department = body.department || null;
    const phone = body.phone || null;
    const ecosystemName = body.ecosystemName || "Ecosystem 1";
    const isFirstAdmin = Boolean(body.isFirstAdmin);

    if (!name || !email || !password || !role) {
      return NextResponse.json(
        { error: "Nome, e-mail, senha e role são obrigatórios" },
        { status: 400, headers: H },
      );
    }
    if (!["admin", "manager", "user"].includes(role)) {
      return NextResponse.json(
        { error: "Role inválida" },
        { status: 400, headers: H },
      );
    }

    const { rows: countRows } = await q(
      "SELECT COUNT(*)::int AS count FROM users",
    );
    const userCount = Number(countRows[0]?.count || 0);

    let ecosystemId: string | null = null;

    // Primeiro admin sem código: se flag presente OU não houver usuários
    if (role === "admin" && (isFirstAdmin || (userCount === 0 && !accessCode))) {
      const { rows: ecoRows } = await q(
        "INSERT INTO ecosystems (name) VALUES ($1) RETURNING id",
        [ecosystemName],
      );
      ecosystemId = ecoRows[0].id;
    } else {
      if (!accessCode) {
        return NextResponse.json(
          { error: "Código de acesso é obrigatório" },
          { status: 400, headers: H },
        );
      }
      const { rows: codeRows } = await q(
        `SELECT * FROM access_codes
          WHERE code = $1
            AND is_active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
            AND used_count < max_uses`,
        [accessCode],
      );
      const code = codeRows[0] as any;
      if (!code) {
        return NextResponse.json(
          { error: "Código de acesso inválido" },
          { status: 400, headers: H },
        );
      }
      if (code.role !== role) {
        return NextResponse.json(
          { error: "Código não corresponde ao tipo selecionado" },
          { status: 400, headers: H },
        );
      }
      ecosystemId = code.ecosystem_id;
      await q(
        `UPDATE access_codes
            SET used_at = NOW(),
                used_by = $1,
                used_count = used_count + 1,
                is_active = CASE WHEN used_count + 1 >= max_uses THEN FALSE ELSE TRUE END
          WHERE id = $2`,
        [null, code.id],
      );
    }

    const { rows: existing } = await q(
      "SELECT id FROM users WHERE email = $1 AND ecosystem_id = $2",
      [email, ecosystemId],
    );
    if (existing[0]) {
      return NextResponse.json(
        { error: "E-mail já cadastrado neste ecossistema" },
        { status: 409, headers: H },
      );
    }

    const passwordHash = await hashPassword(password);
    const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
    const { rows: created } = await q(
      `INSERT INTO users (name, email, password_hash, role, department, phone, invite_code, ecosystem_id, email_verified, email_verification_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        name,
        email,
        passwordHash,
        role,
        department,
        phone,
        accessCode || null,
        ecosystemId,
        false,
        verificationCode,
      ],
    );
    const userRow = created[0] as any;

    const session = await createSession(userRow.id);

    // Enviar email de boas-vindas + confirmação
    try {
      await sendMail({
        to: email,
        subject: "Bem-vindo ao JuriSync - confirme seu email",
        text: `Olá ${name},\n\nBem-vindo ao JuriSync! Digite o código abaixo na aplicação para confirmar seu email:\n\n${verificationCode}\n\nSe não reconhece esta conta, ignore este email.`,
        html: `<p>Olá ${name},</p><p>Bem-vindo ao JuriSync!</p><p>Digite o código abaixo na aplicação para confirmar seu email:</p><p style="font-size:20px;font-weight:bold;">${verificationCode}</p><p>Se não reconhece esta conta, ignore este email.</p>`,
      });
    } catch (mailErr) {
      console.warn("Falha ao enviar email de boas-vindas:", mailErr);
    }

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
