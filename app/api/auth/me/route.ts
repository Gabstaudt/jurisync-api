import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401, headers: H },
    );
  }

  return NextResponse.json({ user: session.user }, { headers: H });
}
