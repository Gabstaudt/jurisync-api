import { NextResponse } from "next/server";
import { q } from "@/lib/db";

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

export async function GET() {
  try {
    const r = await q("select now(), current_catalog as db"); // <- sem genérico
    const row = (r.rows[0] ?? {}) as { now?: string; db?: string };

    return NextResponse.json(
      { ok: true, now: row.now, db: row.db },
      { headers: H }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500, headers: H });
  }
}
