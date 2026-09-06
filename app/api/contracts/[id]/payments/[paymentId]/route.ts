import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STATUS = ["pendente", "pago"] as const;

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id, paymentId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const { status, amount, dueDate, notes } = body || {};

  if (status !== undefined && !STATUS.includes(status)) {
    return NextResponse.json({ error: "Status invalido" }, { status: 400, headers: H });
  }

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    values.push(status);
    updates.push(`paid_at = $${idx++}`);
    values.push(status === "pago" ? new Date() : null);
  }
  if (amount !== undefined) {
    updates.push(`amount = $${idx++}`);
    values.push(Number(amount));
  }
  if (dueDate !== undefined) {
    updates.push(`due_date = $${idx++}`);
    values.push(new Date(dueDate));
  }
  if (notes !== undefined) {
    updates.push(`notes = $${idx++}`);
    values.push(notes);
  }
  updates.push(`updated_at = NOW()`);

  values.push(paymentId, id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE contract_payments SET ${updates.join(", ")}
     WHERE id = $${idx++} AND contract_id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json({ error: "Parcela nao encontrada" }, { status: 404, headers: H });
  }

  return NextResponse.json(mapPayment(rows[0]), { headers: H });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id, paymentId } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rowCount } = await q(
    "DELETE FROM contract_payments WHERE id = $1 AND contract_id = $2 AND ecosystem_id = $3",
    [paymentId, id, session.user.ecosystemId],
  );

  if (!rowCount) {
    return NextResponse.json({ error: "Parcela nao encontrada" }, { status: 404, headers: H });
  }

  return NextResponse.json({ ok: true }, { headers: H });
}
