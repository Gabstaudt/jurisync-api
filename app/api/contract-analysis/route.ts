import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";
import { createRequire } from "module";

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

const extractTextFromFile = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  const isDoc = name.endsWith(".doc") || type === "application/msword";
  const isDocxByExt = name.endsWith(".docx");
  const isDocxByMime =
    type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    type.includes("officedocument.wordprocessingml.document");
  // DOCX e outros Office Open XML sao zip e comecam com PK
  const isZipSignature = buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;

  if (type.includes("pdf") || name.endsWith(".pdf")) {
    const require = createRequire(import.meta.url);
    let pdfParse: any;
    try {
      const mod: any = require("pdf-parse");
      pdfParse = typeof mod === "function" ? mod : mod?.default;
    } catch (err: any) {
      throw new Error("pdf-parse nao instalado. Rode npm install no backend.");
    }
    if (typeof pdfParse !== "function") {
      throw new Error("Falha ao carregar parser de PDF");
    }
    const parsed = await pdfParse(buffer);
    return parsed?.text || "";
  }

  if (isDoc) {
    throw new Error("Formato .doc nao suportado. Envie PDF ou DOCX.");
  }

  if (isDocxByExt || isDocxByMime || (type.includes("word") && isZipSignature)) {
    try {
      const { value } = await mammoth.extractRawText({ buffer });
      return value || "";
    } catch (err: any) {
      if (String(err?.message || "").includes("central directory")) {
        throw new Error("Arquivo DOCX invalido/corrompido. Reexporte e tente novamente.");
      }
      throw err;
    }
  }

  // Fallback para texto simples
  return buffer.toString("utf-8");
};

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const contentType = req.headers.get("content-type") || "";
    let text = "";
    let filename = "contrato";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "Arquivo nao enviado" }, { status: 400, headers: H });
      }
      filename = file.name || filename;
      text = (await extractTextFromFile(file)).trim();
    } else {
      const body = await req.json().catch(() => ({}));
      text = (body?.text || "").toString().trim();
      filename = (body?.filename || filename).toString().trim();
    }

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "Texto insuficiente para analise" },
        { status: 400, headers: H },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY nao configurada" },
        { status: 500, headers: H },
      );
    }

    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt =
      `Você é um analista jurídico. Analise o contrato abaixo e responda em JSON estrito ` +
      `com o seguinte formato: {` +
      `"summary": string, ` +
      `"risks": [string], ` +
      `"recommendations": [string]` +
      `}. ` +
      `Não inclua texto fora do JSON. ` +
      `Contrato (${filename}):\n` +
      text.slice(0, 60000);

    const result = await model.generateContent(prompt);
    const responseText = result?.response?.text?.() || "";

    if (!responseText) {
      return NextResponse.json(
        { error: "Resposta vazia da IA" },
        { status: 500, headers: H },
      );
    }

    try {
      const parsed = JSON.parse(responseText);
      return NextResponse.json(parsed, { headers: H });
    } catch {
      return NextResponse.json(
        { summary: responseText, risks: [], recommendations: [] },
        { headers: H },
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
