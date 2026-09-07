import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    `SELECT l.*, u.name AS user_name
     FROM process_lawyers pl
     JOIN lawyers l ON l.id = pl.lawyer_id
     LEFT JOIN users u ON u.id = l.user_id
     WHERE pl.process_id = $1 AND pl.ecosystem_id = $2
     ORDER BY l.name ASC`,
    [id, session.user.ecosystemId],
  );

  return NextResponse.json(
    rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      oab: r.oab,
      userId: r.user_id,
      userName: r.user_name,
    })),
    { headers: H },
  );
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const lawyerId = body?.lawyerId as string | undefined;
  if (!lawyerId) {
    return NextResponse.json({ error: "lawyerId obrigatorio" }, { status: 400, headers: H });
  }

  const { rows: processRows } = await q(
    "SELECT id FROM processes WHERE id = $1 AND ecosystem_id = $2",
    [id, session.user.ecosystemId],
  );
  if (!processRows.length) {
    return NextResponse.json({ error: "Processo nao encontrado" }, { status: 404, headers: H });
  }

  const { rows: lawyerRows } = await q(
    "SELECT id FROM lawyers WHERE id = $1 AND ecosystem_id = $2",
    [lawyerId, session.user.ecosystemId],
  );
  if (!lawyerRows.length) {
    return NextResponse.json({ error: "Advogado nao encontrado" }, { status: 404, headers: H });
  }

  await q(
    `INSERT INTO process_lawyers (process_id, lawyer_id, ecosystem_id)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [id, lawyerId, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const lawyerId = body?.lawyerId as string | undefined;
  if (!lawyerId) {
    return NextResponse.json({ error: "lawyerId obrigatorio" }, { status: 400, headers: H });
  }

  await q(
    `DELETE FROM process_lawyers
     WHERE process_id = $1 AND lawyer_id = $2 AND ecosystem_id = $3`,
    [id, lawyerId, session.user.ecosystemId],
  );

  return NextResponse.json({ ok: true }, { headers: H });
}
