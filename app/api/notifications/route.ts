import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }

    const rows = await listNotifications(session.user.id);
    const data = rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      message: r.message,
      type: r.type,
      actionUrl: r.action_url,
      isRead: r.is_read,
      createdAt: r.created_at,
    }));
    return NextResponse.json(data, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
    }
    const body = await req.json().catch(() => ({}));
    if (body.markAll) {
      await markAllNotificationsRead(session.user.id);
      return NextResponse.json({ ok: true }, { headers: H });
    }
    if (!body.id) {
      return NextResponse.json({ error: "id obrigatorio" }, { status: 400, headers: H });
    }
    await markNotificationRead(session.user.id, body.id);
    return NextResponse.json({ ok: true }, { headers: H });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: H });
  }
}
