import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> },
) {
  const { id, updateId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q(
    "DELETE FROM process_updates WHERE id = $1 AND process_id = $2 AND ecosystem_id = $3",
    [updateId, id, session.user.ecosystemId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: "Registro nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
