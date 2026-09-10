import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const mapAnalysis = (r: any) => ({
  id: r.id,
  contractId: r.contract_id,
  sourceFileName: r.source_file_name,
  summary: r.summary,
  risks: r.risks || [],
  recommendations: r.recommendations || [],
  createdBy: r.created_by,
  createdByName: r.created_by_name,
  createdAt: r.created_at,
});

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
    `SELECT ca.*, u.name AS created_by_name
     FROM contract_analyses ca
     LEFT JOIN users u ON u.id = ca.created_by
     WHERE ca.contract_id = $1 AND ca.ecosystem_id = $2
     ORDER BY ca.created_at DESC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapAnalysis), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const summary = (body?.summary || "").trim();
  const risks = Array.isArray(body?.risks) ? body.risks : [];
  const recommendations = Array.isArray(body?.recommendations) ? body.recommendations : [];
  const sourceFileName = body?.sourceFileName || null;

  if (!summary) {
    return NextResponse.json({ error: "Resumo da analise obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: contractRows } = await q(
    "SELECT id FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!contractRows.length) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO contract_analyses
       (contract_id, ecosystem_id, source_file_name, summary, risks, recommendations, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [
      id,
      session.user.ecosystemId,
      sourceFileName,
      summary,
      JSON.stringify(risks),
      JSON.stringify(recommendations),
      session.user.id,
    ],
  );

  return NextResponse.json(
    mapAnalysis({ ...rows[0], created_by_name: session.user.name }),
    { status: 201, headers: H },
  );
}
