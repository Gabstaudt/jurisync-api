import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth, sanitizeUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session || (session.user.role !== "admin" && session.user.id !== params.id)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const { rows } = await q("SELECT * FROM users WHERE id = $1", [params.id]);
  const u = rows[0];
  if (!u) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(sanitizeUser(u as any), { headers: H });
}

export async function PATCH(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session || (session.user.role !== "admin" && session.user.id !== params.id)) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json().catch(() => ({}));

  if (session.user.role !== "admin") {
    delete body.role;
    delete body.isActive;
    delete body.isPending;
  }

  const fields: string[] = [];
  const values: any[] = [];
  const map: Record<string, string> = {
    name: "name",
    email: "email",
    role: "role",
    department: "department",
    phone: "phone",
    isActive: "is_active",
    isPending: "is_pending",
  };
  Object.entries(map).forEach(([k, col]) => {
    if (body[k] !== undefined) {
      fields.push(`${col} = $${fields.length + 1}`);
      values.push(body[k]);
    }
  });
  if (!fields.length) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400, headers: H });
  }
  values.push(params.id);

  const { rows } = await q(
    `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
    values,
  );
  const u = rows[0];
  if (!u) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(sanitizeUser(u as any), { headers: H });
}
