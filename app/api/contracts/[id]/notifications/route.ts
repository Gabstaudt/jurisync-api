import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { rows } = await q(
    "SELECT * FROM contract_notifications WHERE contract_id = $1 ORDER BY created_at DESC",
    [params.id],
  );

  const data = (rows as any[]).map((n) => ({
    id: n.id,
    contractId: n.contract_id,
    type: n.type,
    message: n.message,
    recipients: n.recipients || [],
    scheduledFor: n.scheduled_for,
    sentAt: n.sent_at,
    isActive: n.is_active,
    createdBy: n.created_by,
    createdAt: n.created_at,
  }));

  return NextResponse.json(data, { headers: H });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }

  const body = await req.json().catch(() => ({}));
  const type = body.type || "custom";
  if (!["expiry_reminder", "expiry_warning", "custom"].includes(type)) {
    return NextResponse.json(
      { error: "Tipo inválido" },
      { status: 400, headers: H },
    );
  }

  const recipients = Array.isArray(body.recipients) ? body.recipients : [];
  if (!recipients.length) {
    return NextResponse.json(
      { error: "Destinatários são obrigatórios" },
      { status: 400, headers: H },
    );
  }

  const scheduled = body.scheduledFor
    ? new Date(body.scheduledFor)
    : new Date();

  const { rows } = await q(
    `INSERT INTO contract_notifications
      (contract_id, type, message, recipients, scheduled_for, is_active, created_by)
     VALUES ($1,$2,$3,$4,$5,TRUE,$6)
     RETURNING *`,
    [params.id, type, body.message || null, recipients, scheduled, session.user.id],
  );

  const n = rows[0];
  return NextResponse.json(
    {
      id: n.id,
      contractId: n.contract_id,
      type: n.type,
      message: n.message,
      recipients: n.recipients || [],
      scheduledFor: n.scheduled_for,
      sentAt: n.sent_at,
      isActive: n.is_active,
      createdBy: n.created_by,
      createdAt: n.created_at,
    },
    { status: 201, headers: H },
  );
}
