import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";

export const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const mapTemplate = (row: any) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  filePath: row.file_path,
  fileName: row.file_name,
  fileType: row.file_type,
  fileSize: row.file_size,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapHistory = (row: any) => ({
  id: row.id,
  action: row.action,
  changedFields: row.changed_fields,
  createdAt: row.created_at,
  createdBy: row.created_by,
  createdByName: row.created_by_name,
});

export async function requireSession(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return { error: "Nao autenticado" as const, session: null };
  }
  return { session, error: null };
}
