import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

const withCors = (req: NextRequest) => {
  const origin = req.headers.get("origin") || "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 200, headers: withCors(req) });
}

export async function DELETE(req: NextRequest, context: { params?: { id?: string } }) {
  const session = await requireAuth(req);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403, headers: withCors(req) });
  }

  const id = context?.params?.id;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatorio" }, { status: 400, headers: withCors(req) });
  }

  await q(
    `UPDATE access_codes
        SET is_active = FALSE
      WHERE id = $1 AND ecosystem_id = $2`,
    [id, session.user.ecosystemId],
  );

  return new NextResponse(null, { status: 204, headers: withCors(req) });
}
