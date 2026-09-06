import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
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
  attachments: r.attachments || [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// Gera parcelas mensais entre start_date e end_date do contrato,
// dividindo o valor total igualmente. Só roda se o contrato ainda não
// tiver nenhuma parcela (evita duplicar geração).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows: contractRows } = await q(
    "SELECT id, value, start_date, end_date FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  const contract = contractRows[0];
  if (!contract) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: existing } = await q(
    "SELECT 1 FROM contract_payments WHERE contract_id = $1 LIMIT 1",
    [id],
  );
  if (existing.length) {
    return NextResponse.json(
      { error: "Este contrato ja possui parcelas geradas" },
      { status: 409, headers: H },
    );
  }

  const start = new Date(contract.start_date);
  const end = new Date(contract.end_date);

  const months: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= last) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  if (!months.length) {
    return NextResponse.json(
      { error: "Nao foi possivel calcular parcelas para o periodo do contrato" },
      { status: 400, headers: H },
    );
  }

  const total = Number(contract.value) || 0;
  const baseAmount = Math.floor((total / months.length) * 100) / 100;
  const remainder = Math.round((total - baseAmount * months.length) * 100) / 100;

  const writes: string[] = [];
  const values: any[] = [];
  let idx = 1;
  months.forEach((monthStart, i) => {
    const dueDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), start.getDate());
    const amount = i === months.length - 1 ? baseAmount + remainder : baseAmount;
    writes.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(id, session.user.ecosystemId, dueDate, amount, session.user.id);
  });

  const { rows } = await q(
    `INSERT INTO contract_payments (contract_id, ecosystem_id, due_date, amount, created_by)
     VALUES ${writes.join(", ")}
     RETURNING *`,
    values,
  );

  return NextResponse.json(rows.map(mapPayment), { status: 201, headers: H });
}
