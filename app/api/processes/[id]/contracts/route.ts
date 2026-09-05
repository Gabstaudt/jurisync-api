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

const mapContract = (r: any) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  contractingCompany: r.contracting_company,
  contractedParty: r.contracted_party,
  startDate: r.start_date,
  endDate: r.end_date,
  value: Number(r.value),
  currency: r.currency,
  internalResponsible: r.internal_responsible,
  responsibleEmail: r.responsible_email,
  status: r.status,
  priority: r.priority,
  tags: r.tags || [],
  folderId: r.folder_id,
  isArchived: r.is_archived,
  ownerId: r.owner_id,
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
    `SELECT c.*
     FROM process_contracts pc
     JOIN contracts c ON c.id = pc.contract_id
     WHERE pc.process_id = $1 AND pc.ecosystem_id = $2
     ORDER BY c.updated_at DESC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapContract), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const contractId = body?.contractId as string | undefined;
  if (!contractId) {
    return NextResponse.json({ error: "contractId obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: contractRows } = await q(
    "SELECT id FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [contractId, session.user.ecosystemId],
  );
  if (!contractRows.length) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  await q(
    `INSERT INTO process_contracts (process_id, contract_id, ecosystem_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [id, contractId, session.user.ecosystemId],
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
  const contractId = body?.contractId as string | undefined;
  if (!contractId) {
    return NextResponse.json({ error: "contractId obrigatorio" }, { status: 400, headers: H });
  }

  await q(
    `DELETE FROM process_contracts
     WHERE process_id = $1 AND contract_id = $2 AND ecosystem_id = $3`,
    [id, contractId, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}
