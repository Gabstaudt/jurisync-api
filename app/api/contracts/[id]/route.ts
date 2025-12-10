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
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }

  const { rows } = await q(
    "SELECT * FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [params.id, session.user.ecosystemId],
  );
  if (!rows[0]) {
    return NextResponse.json(
      { error: "Contrato não encontrado" },
      { status: 404, headers: H },
    );
  }
  return NextResponse.json(mapRow(rows[0]), { headers: H });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }

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
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400, headers: H },
    );
  }

  values.push(params.id, session.user.ecosystemId);
  const { rows } = await q(
    `UPDATE contracts SET ${fields.join(
      ", ",
    )}, updated_at = NOW() WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length} RETURNING *`,
    values,
  );

  if (!rows[0]) {
    return NextResponse.json(
      { error: "Contrato não encontrado" },
      { status: 404, headers: H },
    );
  }

  return NextResponse.json(mapRow(rows[0]), { headers: H });
}
