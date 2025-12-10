import { NextResponse } from "next/server";
import { bearerFromRequest, revokeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function POST(req: Request) {
  const token = bearerFromRequest(req);
  if (token) await revokeSession(token);
  return NextResponse.json({ ok: true }, { headers: H });
}
