import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

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
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Arquivo é obrigatório" },
        { status: 400, headers: H },
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || "";
    const safeName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadDir, safeName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json(
      {
        fileName: file.name,
        fileType: file.type || ext.replace(".", ""),
        fileSize: file.size,
        filePath: `/uploads/${safeName}`,
      },
      { status: 201, headers: H },
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro ao fazer upload" },
      { status: 500, headers: H },
    );
  }
}
