import { NextResponse } from "next/server";
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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }
  const { rows } = await q(
    `SELECT * FROM contracts WHERE folder_id = $1 AND ecosystem_id = $2 ORDER BY updated_at DESC`,
    [params.id, session.user.ecosystemId],
  );

  const now = new Date();
  const data = (rows as any[]).map((r) => {
    const endDate = new Date(r.end_date);
    const daysUntil = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
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
  });

  return NextResponse.json(data, { headers: H });
}
