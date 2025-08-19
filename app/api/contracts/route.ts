import { NextResponse } from "next/server";
import { q } from "@/lib/db";

export const runtime = "nodejs";        // precisamos de TCP
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET() {
  try {
    const r = await q<{ now: string; db: string }>("select now(), current_catalog as db");
    return NextResponse.json({ ok: true, now: r.rows[0].now, db: r.rows[0].db }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: H });
  }
}
