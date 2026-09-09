import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { addDays } from "@/lib/holidays";

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

export async function POST(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const body = await req.json().catch(() => ({}));
  const startDate = body?.startDate ? new Date(body.startDate) : null;
  const days = Number(body?.days);
  const mode = body?.mode === "uteis" ? "uteis" : "corridos";

  if (!startDate || Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Data de inicio invalida" }, { status: 400, headers: H });
  }
  if (!Number.isInteger(days) || days < 1) {
    return NextResponse.json({ error: "Quantidade de dias invalida" }, { status: 400, headers: H });
  }

  const dueDate = await addDays(startDate, days, mode);

  return NextResponse.json(
    { dueDate: dueDate.toISOString().slice(0, 10), mode },
    { headers: H },
  );
}
