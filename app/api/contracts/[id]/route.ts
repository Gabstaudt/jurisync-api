import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const mapRow = (r: any) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  contractingCompany: r.contracting_company,
  contractedParty: r.contracted_party,
  startDate: r.start_date,
  endDate: r.end_date,
  value: Number(r.value),
  currency: r.currency,
  internalResponsible: r.internal_responsible,
  responsibleEmail: r.responsible_email,
  status: r.status,
  priority: r.priority,
  tags: r.tags || [],
  folderId: r.folder_id,
  permissions: r.permissions,
  attachments: r.attachments,
  notifications: r.notifications,
  isArchived: r.is_archived,
  ownerId: r.owner_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  responsibleIds: r.responsible_ids || [],
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  // Primeiro tenta no ecossistema do usuário
  let rows = (
    await q(
      `SELECT c.*, COALESCE(
        (SELECT ARRAY_AGG(cr.user_id) FROM contract_responsibles cr WHERE cr.contract_id = c.id),
        '{}'::uuid[]
      ) AS responsible_ids
       FROM contracts c
       WHERE c.id = $1 AND c.ecosystem_id = $2`,
      [params.id, session.user.ecosystemId],
    )
  ).rows;

  // Se não encontrou e o usuário é admin, busca globalmente
  if (!rows[0] && session.user.role === "admin") {
    rows = (
      await q(
        `SELECT c.*, COALESCE(
          (SELECT ARRAY_AGG(cr.user_id) FROM contract_responsibles cr WHERE cr.contract_id = c.id),
          '{}'::uuid[]
        ) AS responsible_ids
         FROM contracts c
         WHERE c.id = $1`,
        [params.id],
      )
    ).rows;
  }

  if (!rows[0]) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  return NextResponse.json(mapRow(rows[0]), { headers: H });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  // Admin pode atualizar qualquer contrato; demais somente dentro do ecossistema
  const ecosystemScope = session.user.role === "admin" ? null : session.user.ecosystemId;

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];
  const mapping: Record<string, string> = {
    name: "name",
    description: "description",
    contractingCompany: "contracting_company",
    contractedParty: "contracted_party",
    startDate: "start_date",
    endDate: "end_date",
    value: "value",
    currency: "currency",
    internalResponsible: "internal_responsible",
    responsibleEmail: "responsible_email",
    status: "status",
    priority: "priority",
    tags: "tags",
    folderId: "folder_id",
    permissions: "permissions",
    attachments: "attachments",
    notifications: "notifications",
    isArchived: "is_archived",
    ownerId: "owner_id",
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (body[key] !== undefined) {
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(body[key]);
    }
  });

  if (!fields.length) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400, headers: H });
  }

  values.push(params.id);
  let sql = `UPDATE contracts SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`;
  if (ecosystemScope) {
    values.push(ecosystemScope);
    sql += ` AND ecosystem_id = $${values.length}`;
  }
  sql += " RETURNING *";

  const { rows } = await q(sql, values);
  if (!rows[0]) {
    return NextResponse.json({ error: "Contrato nao encontrado" }, { status: 404, headers: H });
  }

  // Atualiza responsáveis se enviados
  if (Array.isArray(body.responsibleIds)) {
    await q("DELETE FROM contract_responsibles WHERE contract_id = $1", [params.id]);
    const uniqueIds = Array.from(new Set(body.responsibleIds.filter(Boolean)));
    for (const uid of uniqueIds) {
      await q(
        `INSERT INTO contract_responsibles (contract_id, user_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [params.id, uid],
      );
    }
  }

  const refreshed = (
    await q(
      `SELECT c.*, COALESCE(
        (SELECT ARRAY_AGG(cr.user_id) FROM contract_responsibles cr WHERE cr.contract_id = c.id),
        '{}'::uuid[]
      ) AS responsible_ids
       FROM contracts c WHERE c.id = $1`,
      [params.id],
    )
  ).rows[0];

  return NextResponse.json(mapRow(refreshed), { headers: H });
}
