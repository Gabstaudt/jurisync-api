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

const mapDeadline = (r: any) => ({
  id: r.id,
  processId: r.process_id,
  processTitle: r.process_title,
  title: r.title,
  dueDate: r.due_date,
  status: r.status,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// Lista todos os prazos do ecossistema (usado em painéis agregados de risco).
export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    `SELECT pd.*, p.title AS process_title
     FROM process_deadlines pd
     JOIN processes p ON p.id = pd.process_id
     WHERE pd.ecosystem_id = $1
     ORDER BY pd.due_date ASC`,
    [session.user.ecosystemId],
  );

  return NextResponse.json(rows.map(mapDeadline), { headers: H });
}
