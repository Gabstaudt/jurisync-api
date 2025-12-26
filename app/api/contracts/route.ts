import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const parsePermissions = (value: any) => {
  if (!value || value === "") return { isPublic: true, canView: [], canEdit: [], canComment: [] };
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { isPublic: true, canView: [], canEdit: [], canComment: [] };
    }
  }
  if (typeof value === "object") return value;
  return { isPublic: true, canView: [], canEdit: [], canComment: [] };
};

const ensureSelfAccess = (permissions: any, userId: string, ownerId?: string | null) => {
  const ids = [userId, ownerId].filter(Boolean) as string[];
  const dedupe = (arr?: string[]) => Array.from(new Set([...(arr || []), ...ids]));
  const parsed = parsePermissions(permissions);
  return {
    isPublic: parsed.isPublic ?? true,
    canView: dedupe(parsed.canView),
    canEdit: dedupe(parsed.canEdit),
    canComment: dedupe(parsed.canComment),
  };
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
    permissions: parsePermissions(r.permissions),
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
    const parsedAttachments = (() => {
      if (data.attachments === "" || data.attachments === null) return [];
      if (typeof data.attachments === "string") {
        try {
          return JSON.parse(data.attachments);
        } catch {
          return [];
        }
      }
      if (Array.isArray(data.attachments)) return data.attachments;
      return [];
    })();
    const parsedNotifications = (() => {
      if (data.notifications === "" || data.notifications === null) return [];
      if (typeof data.notifications === "string") {
        try {
          return JSON.parse(data.notifications);
        } catch {
          return [];
        }
      }
      if (Array.isArray(data.notifications)) return data.notifications;
      return [];
    })();
    const parsedPermissions = (() => {
      if (data.permissions === "" || data.permissions === null) return null;
      if (typeof data.permissions === "string") {
        try {
          return JSON.parse(data.permissions);
        } catch {
          return null;
        }
      }
      if (typeof data.permissions === "object") return data.permissions;
      return null;
    })();
    const parsedTags = (() => {
      if (data.tags === "" || data.tags === null) return [];
      if (Array.isArray(data.tags)) return data.tags;
      return [];
    })();

    data.attachments = parsedAttachments;
    data.notifications = parsedNotifications;
    data.permissions = ensureSelfAccess(
      parsedPermissions || {
        isPublic: true,
        canView: [],
        canEdit: [],
        canComment: [],
      },
      session.user.id,
      data.ownerId || session.user.id,
    );
    data.tags = parsedTags;

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
        let val = data[k];
        // Garantir JSON válido para colunas jsonb
        if (["attachments", "notifications", "permissions"].includes(k)) {
          val = JSON.stringify(val);
        }
        cols.push(col);
        vals.push(val);
      }
    });

    cols.push("created_by", "ecosystem_id");
    vals.push(session.user.id, session.user.ecosystemId);

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await q(
      `INSERT INTO contracts (${cols.join(",")}) VALUES (${placeholders}) RETURNING *`,
      vals,
    );

    const created = rows[0];

    // Notificar usuarios do ecossistema (exceto criador)
    try {
      const { rows: users } = await q(
        "SELECT id, name FROM users WHERE ecosystem_id = $1 AND id <> $2",
        [session.user.ecosystemId, session.user.id],
      );
      const title = "Novo contrato adicionado";
      const message = `${session.user.name} adicionou o contrato "${created.name}"`;
      const actionUrl = `/contracts/${created.id}`;
      await Promise.all(
        users.map((u: any) =>
          createNotification({
            userId: u.id,
            ecosystemId: session.user.ecosystemId,
            title,
            message,
            type: "info",
            actionUrl,
          }),
        ),
      );
    } catch {
      // silencioso para não quebrar criação de contrato
    }

    return NextResponse.json(mapRow(created), { status: 201, headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: H });
  }
}
