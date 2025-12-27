import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";
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

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));
  const { rows } = await q(
    `UPDATE users
       SET email_verification_token = $1,
           email_verified = FALSE,
           updated_at = NOW()
     WHERE id = $2
     RETURNING name, email`,
    [verificationCode, session.user.id],
  );
  const u = rows[0];
  if (!u) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404, headers: H });
  }

  try {
    await sendMail({
      to: u.email,
      subject: "Confirme seu email no JuriSync",
      text: `Olá ${u.name},\n\nDigite o código abaixo na aplicação para confirmar seu email:\n\n${verificationCode}\n\nSe não reconhece, ignore este email.`,
      html: `<p>Olá ${u.name},</p><p>Digite o código abaixo na aplicação para confirmar seu email:</p><p style="font-size:20px;font-weight:bold;">${verificationCode}</p><p>Se não reconhece, ignore este email.</p>`,
    });
  } catch (mailErr) {
    console.warn("Falha ao reenviar email de confirmacao:", mailErr);
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: H });
}
