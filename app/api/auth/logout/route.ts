import { NextResponse } from "next/server";
import { bearerFromRequest, revokeSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

const withCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 200, headers: withCors(req) });
}

export async function POST(req: Request) {
  const token = bearerFromRequest(req);
  if (token) await revokeSession(token);
  return NextResponse.json({ ok: true }, { headers: withCors(req) });
}
