import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const mapProcess = (r: any) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  folderId: r.folder_id,
  involvedParties: r.involved_parties || [],
  responsibleId: r.responsible_id,
  notes: r.notes,
  actionGroup: r.action_group,
  phase: r.phase,
  cnjNumber: r.cnj_number,
  protocolNumber: r.protocol_number,
  originProcess: r.origin_process,
  requestDate: r.request_date,
  claimValue: r.claim_value,
  feesValue: r.fees_value,
  feesPercentage: r.fees_percentage,
  contingency: r.contingency,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
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
    `SELECT p.*
     FROM process_contracts pc
     JOIN processes p ON p.id = pc.process_id
     WHERE pc.contract_id = $1 AND pc.ecosystem_id = $2
     ORDER BY p.updated_at DESC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapProcess), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const processId = body?.processId as string | undefined;
  if (!processId) {
    return NextResponse.json({ error: "processId obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: contractRows } = await q(
    "SELECT id FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!contractRows.length) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [processId, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  await q(
    `INSERT INTO process_contracts (process_id, contract_id, ecosystem_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [processId, id, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const processId = body?.processId as string | undefined;
  if (!processId) {
    return NextResponse.json({ error: "processId obrigatorio" }, { status: 400, headers: H });
  }

  await q(
    `DELETE FROM process_contracts
     WHERE process_id = $1 AND contract_id = $2 AND ecosystem_id = $3`,
    [processId, id, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}
