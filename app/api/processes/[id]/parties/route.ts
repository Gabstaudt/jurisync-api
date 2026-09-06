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

const SIDES = ["ativa", "passiva", "advogado", "outro"] as const;

const mapProcessParty = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  partyId: r.party_id,
  partyName: r.party_name,
  partyRole: r.party_role,
  side: r.side,
  representsPartyId: r.represents_party_id,
  representsPartyName: r.represents_party_name,
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
    `SELECT pp.*, p.name AS party_name, p.role AS party_role, rp.name AS represents_party_name
     FROM process_parties pp
     JOIN parties p ON p.id = pp.party_id
     LEFT JOIN parties rp ON rp.id = pp.represents_party_id
     WHERE pp.process_id = $1 AND pp.ecosystem_id = $2
     ORDER BY pp.created_at ASC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapProcessParty), { headers: H });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const partyId = body?.partyId as string | undefined;
  const side = body?.side || null;
  const representsPartyId = body?.representsPartyId || null;

  if (!partyId) {
    return NextResponse.json({ error: "partyId obrigatorio" }, { status: 400, headers: H });
  }
  if (side !== null && !SIDES.includes(side)) {
    return NextResponse.json({ error: "Papel processual invalido" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: partyRows } = await q(
    "SELECT id FROM parties WHERE id = $1 AND ecosystem_id = $2",
    [partyId, session.user.ecosystemId],
  );
  if (!partyRows.length) {
    return NextResponse.json({ error: "Parte nao encontrada" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO process_parties (process_id, party_id, ecosystem_id, side, represents_party_id)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (process_id, party_id) DO UPDATE SET side = EXCLUDED.side, represents_party_id = EXCLUDED.represents_party_id
     RETURNING *`,
    [id, partyId, session.user.ecosystemId, side, representsPartyId],
  );

  const { rows: full } = await q(
    `SELECT pp.*, p.name AS party_name, p.role AS party_role, rp.name AS represents_party_name
     FROM process_parties pp
     JOIN parties p ON p.id = pp.party_id
     LEFT JOIN parties rp ON rp.id = pp.represents_party_id
     WHERE pp.id = $1`,
    [rows[0].id],
  );

  return NextResponse.json(mapProcessParty(full[0]), { status: 201, headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const partyId = body?.partyId as string | undefined;
  if (!partyId) {
    return NextResponse.json({ error: "partyId obrigatorio" }, { status: 400, headers: H });
  }

  await q(
    "DELETE FROM process_parties WHERE process_id = $1 AND party_id = $2 AND ecosystem_id = $3",
    [id, partyId, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}
