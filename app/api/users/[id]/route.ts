import { NextResponse } from "next/server";
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: H });
  }
  if (session.user.role !== "admin" && session.user.id !== params.id) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const { rows } = await q("SELECT * FROM users WHERE id = $1", [params.id]);
  if (!rows[0]) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404, headers: H });
  }
  return NextResponse.json(sanitizeUser(rows[0] as any), { headers: H });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401, headers: H });
  }
  if (session.user.role !== "admin" && session.user.id !== params.id) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];

  const allowed: Record<string, string> = {
    name: "name",
    email: "email",
    role: "role",
    department: "department",
    phone: "phone",
    isActive: "is_active",
  };

  Object.entries(allowed).forEach(([key, column]) => {
    if (body[key] !== undefined) {
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(column === "email" ? String(body[key]).toLowerCase() : body[key]);
    }
  });

  if (!fields.length) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400, headers: H });
  }

  values.push(params.id);
  const { rows } = await q(
    `UPDATE users SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${
      values.length
    } RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Usuário não encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(sanitizeUser(rows[0] as any), { headers: H });
}
