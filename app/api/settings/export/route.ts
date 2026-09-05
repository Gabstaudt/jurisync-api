import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Expose-Headers": "Content-Disposition",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const eco = session.user.ecosystemId;
  const userId = session.user.id;

  const [userRes, foldersRes, contractsRes, processesRes, tasksRes] = await Promise.all([
    q("SELECT id, name, email, role, department, phone, created_at FROM users WHERE id = $1", [userId]),
    q("SELECT * FROM folders WHERE ecosystem_id = $1", [eco]),
    q("SELECT * FROM contracts WHERE ecosystem_id = $1", [eco]),
    q("SELECT * FROM processes WHERE ecosystem_id = $1", [eco]),
    q("SELECT * FROM tasks WHERE ecosystem_id = $1", [eco]).catch(() => ({ rows: [] })),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: userRes.rows[0] || null,
    folders: foldersRes.rows || [],
    contracts: contractsRes.rows || [],
    processes: processesRes.rows || [],
    tasks: tasksRes.rows || [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...H,
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename=\"jurisync-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json\"`,
    },
  });
}
