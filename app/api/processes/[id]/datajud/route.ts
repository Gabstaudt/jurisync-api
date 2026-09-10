import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { fetchMovimentacoes } from "@/lib/datajud";

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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    "SELECT cnj_number FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!rows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const cnjNumber = rows[0].cnj_number;
  if (!cnjNumber) {
    return NextResponse.json(
      { configured: false, reason: "Processo sem numero CNJ cadastrado" },
      { headers: H },
    );
  }

  const result = await fetchMovimentacoes(cnjNumber);

  if (!result.configured) {
    return NextResponse.json(
      { configured: false, reason: "Integracao com o DataJud ainda nao foi configurada (falta DATAJUD_API_KEY)" },
      { headers: H },
    );
  }

  if ("error" in result) {
    return NextResponse.json({ configured: true, error: result.error }, { status: 502, headers: H });
  }

  return NextResponse.json(
    { configured: true, movimentos: result.movimentos, debug: result.debug },
    { headers: H },
  );
}
