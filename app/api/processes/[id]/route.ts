import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const CONTINGENCY_VALUES = new Set(["alta", "possivel", "remota"]);

const normalizeParties = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

const mapProcess = (row: any) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  folderId: row.folder_id,
  involvedParties: row.involved_parties || [],
  responsibleId: row.responsible_id,
  notes: row.notes,
  actionGroup: row.action_group,
  phase: row.phase,
  cnjNumber: row.cnj_number,
  protocolNumber: row.protocol_number,
  originProcess: row.origin_process,
  requestDate: row.request_date,
  claimValue: row.claim_value,
  feesValue: row.fees_value,
  feesPercentage: row.fees_percentage,
  contingency: row.contingency,
  ecosystemId: row.ecosystem_id,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const { rows } = await q(
    `SELECT * FROM processes WHERE id = $1 AND ecosystem_id = $2`,
    [params.id, session.user.ecosystemId],
  );
  if (!rows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }
  return NextResponse.json(mapProcess(rows[0]), { headers: H });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json();
  const {
    title,
    description,
    status,
    folderId,
    involvedParties,
    responsibleId,
    notes,
    actionGroup,
    phase,
    cnjNumber,
    protocolNumber,
    originProcess,
    requestDate,
    claimValue,
    feesValue,
    feesPercentage,
    contingency,
  } = body || {};

  if (contingency && !CONTINGENCY_VALUES.has(contingency)) {
    return NextResponse.json({ error: "Contingenciamento invalido" }, { status: 400, headers: H });
  }

  const updates: string[] = [];
  const paramsList: any[] = [];
  let idx = 1;

  if (title !== undefined) {
    updates.push(`title = $${idx++}`);
    paramsList.push(title);
  }
  if (description !== undefined) {
    updates.push(`description = $${idx++}`);
    paramsList.push(description);
  }
  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    paramsList.push(status);
  }
  if (folderId !== undefined) {
    updates.push(`folder_id = $${idx++}`);
    paramsList.push(folderId);
  }
  if (involvedParties !== undefined) {
    updates.push(`involved_parties = $${idx++}`);
    paramsList.push(normalizeParties(involvedParties));
  }
  if (responsibleId !== undefined) {
    updates.push(`responsible_id = $${idx++}`);
    paramsList.push(responsibleId);
  }
  if (notes !== undefined) {
    updates.push(`notes = $${idx++}`);
    paramsList.push(notes);
  }
  if (actionGroup !== undefined) {
    updates.push(`action_group = $${idx++}`);
    paramsList.push(actionGroup);
  }
  if (phase !== undefined) {
    updates.push(`phase = $${idx++}`);
    paramsList.push(phase);
  }
  if (cnjNumber !== undefined) {
    updates.push(`cnj_number = $${idx++}`);
    paramsList.push(cnjNumber);
  }
  if (protocolNumber !== undefined) {
    updates.push(`protocol_number = $${idx++}`);
    paramsList.push(protocolNumber);
  }
  if (originProcess !== undefined) {
    updates.push(`origin_process = $${idx++}`);
    paramsList.push(originProcess);
  }
  if (requestDate !== undefined) {
    updates.push(`request_date = $${idx++}`);
    paramsList.push(requestDate);
  }
  if (claimValue !== undefined) {
    updates.push(`claim_value = $${idx++}`);
    paramsList.push(claimValue);
  }
  if (feesValue !== undefined) {
    updates.push(`fees_value = $${idx++}`);
    paramsList.push(feesValue);
  }
  if (feesPercentage !== undefined) {
    updates.push(`fees_percentage = $${idx++}`);
    paramsList.push(feesPercentage);
  }
  if (contingency !== undefined) {
    updates.push(`contingency = $${idx++}`);
    paramsList.push(contingency);
  }

  updates.push(`updated_at = NOW()`);

  paramsList.push(params.id, session.user.ecosystemId);

  const { rows } = await q(
    `UPDATE processes SET ${updates.join(", ")}
     WHERE id = $${idx++} AND ecosystem_id = $${idx}
     RETURNING *`,
    paramsList,
  );

  if (!rows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(mapProcess(rows[0]), { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const { rowCount } = await q(
    `DELETE FROM processes WHERE id = $1 AND ecosystem_id = $2`,
    [params.id, session.user.ecosystemId],
  );
  if (!rowCount) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }
  return NextResponse.json({ ok: true }, { headers: H });
}
