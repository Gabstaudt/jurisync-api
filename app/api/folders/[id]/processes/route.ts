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

export async function GET(req: NextRequest, context: { params?: Promise<{ id?: string }> | { id?: string } }) {
  const params = (await context?.params) as { id?: string } | undefined;
  if (!params?.id) {
    return NextResponse.json({ error: "Pasta nao encontrada" }, { status: 404, headers: H });
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const { rows } = await q(
    `SELECT * FROM processes WHERE folder_id = $1 AND ecosystem_id = $2 ORDER BY updated_at DESC`,
    [params.id, session.user.ecosystemId],
  );

  const data = (rows as any[]).map((r) => ({
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
  }));

  return NextResponse.json(data, { headers: H });
}
