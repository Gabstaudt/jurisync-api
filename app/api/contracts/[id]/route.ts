import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type ContractPermissions = {
  isPublic?: boolean;
  canView?: string[];
  canEdit?: string[];
  canComment?: string[];
};

const parsePermissions = (value: any): ContractPermissions => {
  if (!value || value === "") return { isPublic: true, canView: [], canEdit: [], canComment: [] };
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { isPublic: true, canView: [], canEdit: [], canComment: [] };
    }
  }
  if (typeof value === "object") return value as ContractPermissions;
  return { isPublic: true, canView: [], canEdit: [], canComment: [] };
};

const ensureSelfAccess = (
  permissions: ContractPermissions,
  userId: string,
  ownerId?: string | null,
): ContractPermissions => {
  const ids = [userId, ownerId].filter(Boolean) as string[];
  const dedupe = (arr?: string[]) => Array.from(new Set([...(arr || []), ...ids]));
  return {
    isPublic: permissions.isPublic ?? true,
    canView: dedupe(permissions.canView),
    canEdit: dedupe(permissions.canEdit),
    canComment: dedupe(permissions.canComment),
  };
};

const canViewContract = (
  permissions: ContractPermissions,
  userId: string,
  userRole: string,
  ownerId?: string | null,
  createdBy?: string | null,
) => {
  if (permissions.isPublic) return true;
  if (["admin", "manager"].includes(userRole)) return true;
  if (userId === ownerId || userId === createdBy) return true;
  const lists = [permissions.canView || [], permissions.canEdit || [], permissions.canComment || []];
  return lists.some((list) => list.includes(userId));
};

const canEditContract = (
  permissions: ContractPermissions,
  userId: string,
  userRole: string,
  ownerId?: string | null,
  createdBy?: string | null,
) => {
  if (["admin", "manager"].includes(userRole)) return true;
  if (userId === ownerId || userId === createdBy) return true;
  return (permissions.canEdit || []).includes(userId);
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
  permissions: parsePermissions(r.permissions),
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

export async function GET(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json(
      { error: "Contrato nao encontrado" },
      { status: 404, headers: H },
    );
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }

  const { rows } = await q(
    "SELECT * FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [params.id, session.user.ecosystemId],
  );
  const contract = rows[0];
  if (!contract) {
    return NextResponse.json(
      { error: "Contrato nao encontrado" },
      { status: 404, headers: H },
    );
  }

  const permissions = ensureSelfAccess(
    parsePermissions(contract.permissions),
    session.user.id,
    contract.owner_id || contract.created_by,
  );
  if (
    !canViewContract(
      permissions,
      session.user.id,
      session.user.role,
      contract.owner_id,
      contract.created_by,
    )
  ) {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: H },
    );
  }

  return NextResponse.json(mapRow({ ...contract, permissions }), { headers: H });
}

export async function PATCH(req: NextRequest, context: any) {
  const params = (context?.params || {}) as { id?: string };
  if (!params.id) {
    return NextResponse.json(
      { error: "Contrato nao encontrado" },
      { status: 404, headers: H },
    );
  }
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Nao autenticado" },
      { status: 401, headers: H },
    );
  }

  const { rows: existingRows } = await q(
    "SELECT * FROM contracts WHERE id = $1 AND ecosystem_id = $2",
    [params.id, session.user.ecosystemId],
  );
  const existing = existingRows[0];
  if (!existing) {
    return NextResponse.json(
      { error: "Contrato nao encontrado" },
      { status: 404, headers: H },
    );
  }

  const currentPerms = parsePermissions(existing.permissions);
  if (
    !canEditContract(
      currentPerms,
      session.user.id,
      session.user.role,
      existing.owner_id,
      existing.created_by,
    )
  ) {
    return NextResponse.json(
      { error: "Acesso negado" },
      { status: 403, headers: H },
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
      let val = body[key];
      if (key === "permissions") {
        val = ensureSelfAccess(
          parsePermissions(body[key]),
          session.user.id,
          body.ownerId || existing.owner_id || existing.created_by,
        );
      }
      fields.push(`${column} = $${fields.length + 1}`);
      values.push(val);
    }
  });

  if (!fields.length) {
    return NextResponse.json(
      { error: "Nenhum campo para atualizar" },
      { status: 400, headers: H },
    );
  }

  values.push(params.id, session.user.ecosystemId);
  const { rows: updatedRows } = await q(
    `UPDATE contracts SET ${fields.join(
      ", ",
    )}, updated_at = NOW() WHERE id = $${values.length - 1} AND ecosystem_id = $${values.length} RETURNING *`,
    values,
  );

  const updated = updatedRows[0];
  if (!updated) {
    return NextResponse.json(
      { error: "Contrato nao encontrado" },
      { status: 404, headers: H },
    );
  }

  return NextResponse.json(mapRow(updated), { headers: H });
}


