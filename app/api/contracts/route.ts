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

const mapRow = (r: any) => {
  const now = new Date();
  const endDate = new Date(r.end_date);
  const daysUntil = Math.ceil(
    (endDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
  );
  const status =
    r.status === "active" && daysUntil <= 7 && daysUntil >= 0
      ? "expiring_soon"
      : r.status;

  return {
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
    status,
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
  };
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// GET /api/contracts?status=active&q=Acme&page=1&limit=20&folderId=uuid
export async function GET(req: Request) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("q") || undefined;
  const folderId = searchParams.get("folderId") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const offset = (page - 1) * limit;

  const params: any[] = [];
  const where: string[] = [];

  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (folderId) {
    params.push(folderId);
    where.push(`folder_id = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(name ILIKE $${params.length} OR contracting_company ILIKE $${params.length} OR contracted_party ILIKE $${params.length})`,
    );
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit, offset);

  const sql = `
    SELECT *
    FROM contracts
    WHERE ecosystem_id = $${params.length + 1}
    ${where.length ? "AND " + where.join(" AND ") : ""}
    ORDER BY updated_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length};
  `;

  try {
    const { rows } = await q(sql, [...params, session.user.ecosystemId]);
    return NextResponse.json((rows as any[]).map(mapRow), { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: H });
  }
}

// POST /api/contracts
export async function POST(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json(
        { error: "Não autenticado" },
        { status: 401, headers: H },
      );
    }

    const data = await req.json().catch(() => ({}));
    // Normaliza campos opcionais que podem vir como string vazia
    if (data.folderId === "") data.folderId = null;
    if (data.ownerId === "") data.ownerId = null;

    for (const k of [
      "name",
      "contractingCompany",
      "contractedParty",
      "internalResponsible",
      "responsibleEmail",
      "startDate",
      "endDate",
    ]) {
      if (!data?.[k]) {
        return NextResponse.json(
          { error: `campo obrigatório: ${k}` },
          { status: 400, headers: H },
        );
      }
    }

    const cols: string[] = [];
    const vals: any[] = [];
    const map: Record<string, string> = {
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

    Object.entries(map).forEach(([k, col]) => {
      if (data[k] !== undefined && data[k] !== null && data[k] !== "") {
        cols.push(col);
        vals.push(data[k]);
      }
    });

    cols.push("created_by", "ecosystem_id");
    vals.push(session.user.id, session.user.ecosystemId);

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await q(
      `INSERT INTO contracts (${cols.join(",")}) VALUES (${placeholders}) RETURNING *`,
      vals,
    );

    return NextResponse.json(mapRow(rows[0]), { status: 201, headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: H });
  }
}
