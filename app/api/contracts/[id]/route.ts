import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

// GET /api/contracts/:id
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { rows } = await q("SELECT * FROM contracts WHERE id = $1", [params.id]);
  if (!rows[0]) return NextResponse.json({ error: "não encontrado" }, { status: 404, headers: H });
  return NextResponse.json(rows[0], { headers: H });
}

// PATCH /api/contracts/:id
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();

  // mapeia os campos aceitos
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
    ownerId: "owner_id"
  };

  const entries = Object.entries(body).filter(([k]) => map[k]);
  if (!entries.length) return NextResponse.json({ error: "nada para atualizar" }, { status: 400, headers: H });

  const sets = entries.map(([k], i) => `${map[k]} = $${i + 1}`).join(", ");
  const vals = entries.map(([, v]) => v);

  const { rows } = await q(
    `UPDATE contracts SET ${sets}, updated_at = now() WHERE id = $${vals.length + 1} RETURNING *`,
    [...vals, params.id]
  );
  if (!rows[0]) return NextResponse.json({ error: "não encontrado" }, { status: 404, headers: H });
  return NextResponse.json(rows[0], { headers: H });
}

// DELETE /api/contracts/:id
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const r = await q("DELETE FROM contracts WHERE id = $1", [params.id]);
  if (!r.rowCount) return NextResponse.json({ error: "não encontrado" }, { status: 404, headers: H });
  return new NextResponse(null, { status: 204, headers: H });
}
