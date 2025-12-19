import { NextResponse } from "next/server";
import crypto from "crypto";
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

export async function GET(req: Request) {
  const session = await requireAuth(req);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: H },
    );
  }

  const { rows } = await q(
    `SELECT * FROM access_codes WHERE ecosystem_id = $1 ORDER BY created_at DESC`,
    [session.user.ecosystemId],
  );
  return NextResponse.json(rows, { headers: H });
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
  const role = body.role || "user";
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  if (!["admin", "manager", "user"].includes(role)) {
    return NextResponse.json(
      { error: "Role inválida" },
      { status: 400, headers: H },
    );
  }

  const code = (body.code || crypto.randomBytes(8).toString("hex")).toUpperCase();

  const { rows } = await q(
    `INSERT INTO access_codes (ecosystem_id, code, role, created_by, expires_at, is_active)
     VALUES ($1,$2,$3,$4,$5,TRUE) RETURNING *`,
    [session.user.ecosystemId, code, role, session.user.id, expiresAt],
  );

  return NextResponse.json(rows[0], { status: 201, headers: H });
}
