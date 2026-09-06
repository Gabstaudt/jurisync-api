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

// Reparcela o saldo AINDA NÃO PAGO em N novas parcelas mensais.
// Parcelas já marcadas como "pago" nunca são tocadas — só as pendentes
// são substituídas, preservando o histórico do que já foi quitado.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const installments = Number(body?.installments);
  if (!Number.isInteger(installments) || installments < 1) {
    return NextResponse.json(
      { error: "Informe uma quantidade de parcelas válida (mínimo 1)" },
      { status: 400, headers: H },
    );
  }

  const { rows: contractRows } = await q(
    "SELECT id, value FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  const contract = contractRows[0];
  if (!contract) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: allPayments } = await q(
    "SELECT * FROM contract_payments WHERE contract_id = $1 AND ecosystem_id = $2 ORDER BY due_date ASC",
    [id, session.user.ecosystemId],
  );

  const paid = allPayments.filter((p: any) => p.status === "pago");
  const pending = allPayments.filter((p: any) => p.status !== "pago");

  const totalPaid = paid.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const remaining = Math.round((Number(contract.value) - totalPaid) * 100) / 100;

  if (remaining <= 0) {
    return NextResponse.json(
      { error: "Não há saldo pendente para reparcelar — o contrato já está quitado" },
      { status: 400, headers: H },
    );
  }

  // Próxima parcela começa no mês seguinte à última parcela (paga ou
  // não) já registrada, ou no mês atual se não houver nenhuma.
  const lastDueDate = allPayments.length
    ? new Date(allPayments[allPayments.length - 1].due_date)
    : new Date();
  const baseAmount = Math.floor((remaining / installments) * 100) / 100;
  const remainder = Math.round((remaining - baseAmount * installments) * 100) / 100;

  await q("DELETE FROM contract_payments WHERE id = ANY($1)", [
    pending.map((p: any) => p.id),
  ]);

  const writes: string[] = [];
  const values: any[] = [];
  let idx = 1;
  for (let i = 0; i < installments; i++) {
    const dueDate = new Date(lastDueDate.getFullYear(), lastDueDate.getMonth() + i + 1, lastDueDate.getDate());
    const amount = i === installments - 1 ? baseAmount + remainder : baseAmount;
    writes.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
    values.push(id, session.user.ecosystemId, dueDate, amount, session.user.id);
  }

  await q(
    `INSERT INTO contract_payments (contract_id, ecosystem_id, due_date, amount, created_by)
     VALUES ${writes.join(", ")}`,
    values,
  );

  const { rows: finalPayments } = await q(
    "SELECT * FROM contract_payments WHERE contract_id = $1 AND ecosystem_id = $2 ORDER BY due_date ASC",
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(finalPayments.map(mapPayment), { headers: H });
}
