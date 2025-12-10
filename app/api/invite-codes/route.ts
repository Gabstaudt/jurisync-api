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

  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("active") === "true";
  const sql = `SELECT * FROM invite_codes ${onlyActive ? "WHERE is_active = TRUE" : ""} ORDER BY created_at DESC`;
  const { rows } = await q(sql);

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
  const email = body.email || null;
  const department = body.department || null;
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const code = (body.code || crypto.randomBytes(4).toString("hex").toUpperCase()).trim();

  if (!["admin", "manager", "user"].includes(role)) {
    return NextResponse.json(
      { error: "Cargo inválido" },
      { status: 400, headers: H },
    );
  }

  const { rows } = await q(
    `INSERT INTO invite_codes (code, email, role, department, created_by, expires_at, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,TRUE) RETURNING *`,
    [code, email, role, department, session.user.id, expiresAt],
  );

  return NextResponse.json(rows[0], { status: 201, headers: H });
}
