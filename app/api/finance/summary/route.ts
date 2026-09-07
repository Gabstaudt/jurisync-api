import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

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

// Painel financeiro: quanto já foi recebido/pago, quanto falta,
// o que está vencido e o que vence nos próximos 30 dias, entre todos
// os contratos do ecossistema.
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const ecosystemId = session.user.ecosystemId;

  const [
    { rows: contractsAgg },
    { rows: paymentsAgg },
    { rows: overdue },
    { rows: upcoming },
    { rows: monthly },
    { rows: processesAgg },
  ] = await Promise.all([
      q(
        `SELECT COALESCE(SUM(value), 0) AS total_contracted, COUNT(*) AS total_contracts
         FROM contracts WHERE ecosystem_id = $1 AND is_archived = FALSE`,
        [ecosystemId],
      ),
      q(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE status = 'pago'), 0) AS total_paid,
           COALESCE(SUM(amount) FILTER (WHERE status = 'pendente'), 0) AS total_pending
         FROM contract_payments WHERE ecosystem_id = $1`,
        [ecosystemId],
      ),
      q(
        `SELECT cp.id, cp.due_date, cp.amount, c.id AS contract_id, c.name AS contract_name
         FROM contract_payments cp
         JOIN contracts c ON c.id = cp.contract_id
         WHERE cp.ecosystem_id = $1 AND cp.status = 'pendente' AND cp.due_date < CURRENT_DATE
         ORDER BY cp.due_date ASC
         LIMIT 50`,
        [ecosystemId],
      ),
      q(
        `SELECT cp.id, cp.due_date, cp.amount, c.id AS contract_id, c.name AS contract_name
         FROM contract_payments cp
         JOIN contracts c ON c.id = cp.contract_id
         WHERE cp.ecosystem_id = $1 AND cp.status = 'pendente'
           AND cp.due_date >= CURRENT_DATE AND cp.due_date < CURRENT_DATE + INTERVAL '30 days'
         ORDER BY cp.due_date ASC
         LIMIT 50`,
        [ecosystemId],
      ),
      q(
        `SELECT to_char(date_trunc('month', due_date), 'YYYY-MM') AS month,
           COALESCE(SUM(amount) FILTER (WHERE status = 'pago'), 0) AS paid,
           COALESCE(SUM(amount) FILTER (WHERE status = 'pendente'), 0) AS pending
         FROM contract_payments
         WHERE ecosystem_id = $1
           AND due_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
           AND due_date < date_trunc('month', CURRENT_DATE) + INTERVAL '7 months'
         GROUP BY 1
         ORDER BY 1 ASC`,
        [ecosystemId],
      ),
      q(
        `SELECT
           COUNT(*) AS total_processes,
           COALESCE(SUM(claim_value), 0) AS total_claim_value,
           COALESCE(SUM(fees_value), 0) AS total_fees
         FROM processes
         WHERE ecosystem_id = $1 AND status != 'encerrado'`,
        [ecosystemId],
      ),
    ]);

  const totalPaid = Number(paymentsAgg[0]?.total_paid || 0);
  const totalPending = Number(paymentsAgg[0]?.total_pending || 0);
  const overdueAmount = overdue.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
  const upcomingAmount = upcoming.reduce((sum: number, r: any) => sum + Number(r.amount), 0);
  const totalProcesses = Number(processesAgg[0]?.total_processes || 0);
  const totalClaimValue = Number(processesAgg[0]?.total_claim_value || 0);
  const totalProcessFees = Number(processesAgg[0]?.total_fees || 0);

  return NextResponse.json(
    {
      totalContracted: Number(contractsAgg[0]?.total_contracted || 0),
      totalContracts: Number(contractsAgg[0]?.total_contracts || 0),
      totalPaid,
      totalPending,
      totalProcesses,
      totalClaimValue,
      totalProcessFees,
      totalReceivable: totalPending + totalProcessFees,
      overdueAmount,
      overdueCount: overdue.length,
      upcomingAmount,
      upcomingCount: upcoming.length,
      overduePayments: overdue.map((r: any) => ({
        id: r.id,
        dueDate: r.due_date,
        amount: Number(r.amount),
        contractId: r.contract_id,
        contractName: r.contract_name,
      })),
      upcomingPayments: upcoming.map((r: any) => ({
        id: r.id,
        dueDate: r.due_date,
        amount: Number(r.amount),
        contractId: r.contract_id,
        contractName: r.contract_name,
      })),
      monthly: monthly.map((r: any) => ({
        month: r.month,
        paid: Number(r.paid),
        pending: Number(r.pending),
      })),
    },
    { headers: H },
  );
}
