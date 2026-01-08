import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function DELETE(req: NextRequest, context: { params: { id?: string } }) {
  const params = context?.params || {};
  if (!params.id) {
    return NextResponse.json({ error: "Codigo nao encontrado" }, { status: 404, headers: H });
  }

  const session = await requireAuth(req);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: H });
  }

  try {
    const { rowCount } = await q(
      "UPDATE access_codes SET is_active = FALSE WHERE id = $1 AND ecosystem_id = $2",
      [params.id, session.user.ecosystemId],
    );
    if (!rowCount) {
      return NextResponse.json({ error: "Codigo nao encontrado" }, { status: 404, headers: H });
    }
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
