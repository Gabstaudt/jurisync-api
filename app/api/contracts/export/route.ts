import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { format } from "date-fns";

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

// GET /api/contracts/export?format=csv
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const formatType = (searchParams.get("format") || "csv").toLowerCase();
  if (formatType !== "csv") {
    return NextResponse.json(
      { error: "Formato não suportado. Use csv." },
      { status: 400, headers: H },
    );
  }

  const { rows } = await q("SELECT * FROM contracts ORDER BY created_at DESC");
  const csv = [
    [
      "Nome do Contrato",
      "Empresa Contratante",
      "Parte Contratada",
      "Data de Início",
      "Data de Vencimento",
      "Valor",
      "Responsável",
      "Email do Responsável",
      "Status",
      "Arquivo",
      "Data de Criação",
    ].join(","),
    ...(rows as any[]).map((c) =>
      [
        `"${c.name}"`,
        `"${c.contracting_company}"`,
        `"${c.contracted_party}"`,
        format(new Date(c.start_date), "dd/MM/yyyy"),
        format(new Date(c.end_date), "dd/MM/yyyy"),
        Number(c.value).toFixed(2),
        `"${c.internal_responsible}"`,
        c.responsible_email,
        c.status,
        c.attachments?.[0]?.fileName || "",
        format(new Date(c.created_at), "dd/MM/yyyy"),
      ].join(","),
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      ...H,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contratos-jurisync.csv"',
    },
  });
}
