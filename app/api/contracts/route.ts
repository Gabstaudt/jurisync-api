import { NextResponse } from "next/server";
import { q } from "@/lib/db";

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

// GET /api/contracts?status=active&q=Acme&page=1&limit=20
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const search = searchParams.get("q") || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  const params: any[] = [];
  const where: string[] = [];

  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(name ILIKE $${params.length} OR contracting_company ILIKE $${params.length} OR contracted_party ILIKE $${params.length})`);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit, offset);

  // calculo 'expiring_soon' para a UI quando faltar <= 7 dias
  const sql = `
    SELECT
      id, name, description, contracting_company, contracted_party,
      start_date, end_date, value, currency, internal_responsible,
      responsible_email, status, priority, folder_id, owner_id, created_by,
      created_at, updated_at,
      CASE
        WHEN status = 'active' AND end_date <= (CURRENT_DATE + INTERVAL '7 days')
        THEN 'expiring_soon' ELSE status::text
      END AS ui_status
    FROM contracts
    ${whereSQL}
    ORDER BY updated_at DESC
    LIMIT $${params.length-1} OFFSET $${params.length};
  `;

  try {
    const { rows } = await q(sql, params);
    for (const r of rows as any[]) if (r.ui_status) r.status = r.ui_status;
    return NextResponse.json(rows, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500, headers: H });
  }
}

// POST /api/contracts
export async function POST(req: Request) {
  try {
    const data = await req.json();

    // obrigatórios mínimos (igual o front usa)
    for (const k of ["name", "contractingCompany", "contractedParty", "internalResponsible", "responsibleEmail"]) {
      if (!data?.[k]) return NextResponse.json({ error: `campo obrigatório: ${k}` }, { status: 400, headers: H });
    }

    // camelCase (front) -> snake_case (DB)
    const map: Record<string,string> = {
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
      folderId: "folder_id",
      ownerId: "owner_id",
      createdBy: "created_by"
    };

    const cols: string[] = [];
    const vals: any[] = [];
    Object.entries(map).forEach(([k, col]) => {
      if (data[k] !== undefined && data[k] !== null) {
        cols.push(col); vals.push(data[k]);
      }
    });
    if (!cols.length) return NextResponse.json({ error: "sem dados" }, { status: 400, headers: H });

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(",");
    const { rows } = await q(
      `INSERT INTO contracts (${cols.join(",")}) VALUES (${placeholders}) RETURNING *`,
      vals
    );

    return NextResponse.json(rows[0], { status: 201, headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400, headers: H });
  }
}
