import { NextResponse } from "next/server";
import crypto from "crypto";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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
  if (!session || session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: withCors(req) },
    );
  }

  await q(
    `UPDATE access_codes
        SET is_active = FALSE
      WHERE ecosystem_id = $1
        AND is_active = TRUE
        AND (
          (expires_at IS NOT NULL AND expires_at <= NOW())
          OR COALESCE(used_count, 0) >= COALESCE(max_uses, 1)
        )`,
    [session.user.ecosystemId],
  );

  const { rows } = await q(
    `SELECT * FROM access_codes
      WHERE ecosystem_id = $1
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
        AND COALESCE(used_count, 0) < COALESCE(max_uses, 1)
      ORDER BY created_at DESC`,
    [session.user.ecosystemId],
  );
  return NextResponse.json(rows, { headers: withCors(req) });
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
  const role = body.role || "user";
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const maxUsesRaw = Number(body.maxUses);
  const maxUses = Number.isFinite(maxUsesRaw) && maxUsesRaw > 0 ? Math.floor(maxUsesRaw) : 1;

  if (!["admin", "manager", "user"].includes(role)) {
    return NextResponse.json(
      { error: "Role inválida" },
      { status: 400, headers: withCors(req) },
    );
  }

  const code = (body.code || crypto.randomBytes(8).toString("hex")).toUpperCase();
  const finalExpires =
    expiresAt && !isNaN(expiresAt.getTime())
      ? expiresAt
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  const { rows } = await q(
    `INSERT INTO access_codes (ecosystem_id, code, role, created_by, expires_at, is_active, max_uses, used_count)
     VALUES ($1,$2,$3,$4,$5,TRUE,$6,0) RETURNING *`,
    [session.user.ecosystemId, code, role, session.user.id, finalExpires, maxUses],
  );

  return NextResponse.json(rows[0], { status: 201, headers: withCors(req) });
}
