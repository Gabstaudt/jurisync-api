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

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId");

  const { rows } = await q(
    `
    SELECT * FROM processes
    WHERE ecosystem_id = $1
      AND ($2::uuid IS NULL OR folder_id = $2)
    ORDER BY updated_at DESC
    `,
    [session.user.ecosystemId, folderId || null],
  );

  return NextResponse.json(rows.map(mapProcess), { headers: H });
}

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json();
  const {
    title,
    description = null,
    status = "ativo",
    folderId = null,
    involvedParties,
    responsibleId = null,
    notes = null,
    actionGroup = null,
    phase = null,
    cnjNumber = null,
    protocolNumber = null,
    originProcess = null,
    requestDate = null,
    claimValue = null,
    feesValue = null,
    feesPercentage = null,
    contingency = null,
  } = body || {};

  if (!title || typeof title !== "string") {
    return NextResponse.json({ error: "Titulo obrigatorio" }, { status: 400, headers: H });
  }
  if (contingency && !CONTINGENCY_VALUES.has(contingency)) {
    return NextResponse.json({ error: "Contingenciamento invalido" }, { status: 400, headers: H });
  }

  const parties = normalizeParties(involvedParties);

  const { rows } = await q(
    `
    INSERT INTO processes (
      title,
      description,
      status,
      folder_id,
      ecosystem_id,
      created_by,
      involved_parties,
      responsible_id,
      notes,
      action_group,
      phase,
      cnj_number,
      protocol_number,
      origin_process,
      request_date,
      claim_value,
      fees_value,
      fees_percentage,
      contingency
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    RETURNING *
    `,
    [
      title,
      description,
      status,
      folderId,
      session.user.ecosystemId,
      session.user.id,
      parties,
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
    ],
  );

  return NextResponse.json(mapProcess(rows[0]), { status: 201, headers: H });
}
