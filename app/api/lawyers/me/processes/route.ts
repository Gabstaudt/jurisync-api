import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// Processos onde o usuario logado esta vinculado como advogado.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    `SELECT DISTINCT p.id, p.title, p.status, p.updated_at
     FROM processes p
     JOIN process_lawyers pl ON pl.process_id = p.id
     JOIN lawyers l ON l.id = pl.lawyer_id
     WHERE l.user_id = $1 AND p.ecosystem_id = $2
     ORDER BY p.updated_at DESC`,
    [session.user.id, session.user.ecosystemId],
  );

  return NextResponse.json(
    rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      updatedAt: r.updated_at,
    })),
    { headers: H },
  );
}
