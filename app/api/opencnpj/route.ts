import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const normalizeCnpj = (value: string) => value.replace(/\D/g, "");

const pick = (obj: any, keys: string[]) => {
  for (const k of keys) {
    if (obj && obj[k]) return obj[k];
  }
  return null;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const cnpjParam = req.nextUrl.searchParams.get("cnpj") || "";
    const cnpj = normalizeCnpj(cnpjParam);
    if (cnpj.length !== 14) {
      return NextResponse.json(
        { valid: false, error: "CNPJ invalido" },
        { status: 400, headers: H },
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.opencnpj.org/${cnpj}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { valid: false, error: "CNPJ nao encontrado" },
        { status: res.status, headers: H },
      );
    }

    const data = await res.json();
    const payload = data?.data || data;
    const corporateName = pick(payload, ["razaoSocial", "razao_social"]);
    const tradeName = pick(payload, ["nomeFantasia", "nome_fantasia"]);
    const status = pick(payload, ["situacaoCadastral", "situacao_cadastral"]);

    if (!corporateName && !tradeName) {
      return NextResponse.json(
        { valid: false, error: "CNPJ nao encontrado" },
        { status: 404, headers: H },
      );
    }

    return NextResponse.json(
      {
        valid: true,
        cnpj,
        corporateName,
        tradeName,
        status,
      },
      { headers: H },
    );
  } catch (e: any) {
    const message = e?.name === "AbortError" ? "Timeout consultando CNPJ" : e?.message;
    return NextResponse.json({ valid: false, error: message || "Erro interno" }, { status: 500, headers: H });
  }
}
