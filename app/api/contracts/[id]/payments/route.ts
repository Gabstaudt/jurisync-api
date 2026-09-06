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

const mapPayment = (r: any) => ({
  id: r.id,
  contractId: r.contract_id,
  dueDate: r.due_date,
  amount: Number(r.amount),
  status: r.status,
  paidAt: r.paid_at,
  notes: r.notes,
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
    `SELECT * FROM contract_payments
     WHERE contract_id = $1 AND ecosystem_id = $2
     ORDER BY due_date ASC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapPayment), { headers: H });
}

// Cria uma parcela avulsa (fora da geração automática).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const dueDate = body?.dueDate;
  const amount = Number(body?.amount);
  const notes = body?.notes || null;

  if (!dueDate) {
    return NextResponse.json({ error: "Data de vencimento obrigatoria" }, { status: 400, headers: H });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: "Valor invalido" }, { status: 400, headers: H });
  }

  const { rows: contractRows } = await q(
    "SELECT id FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!contractRows.length) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  const { rows } = await q(
    `INSERT INTO contract_payments (contract_id, ecosystem_id, due_date, amount, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [id, session.user.ecosystemId, new Date(dueDate), amount, notes, session.user.id],
  );

  return NextResponse.json(mapPayment(rows[0]), { status: 201, headers: H });
}
