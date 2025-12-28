import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const baseHeaders = {
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Credentials": "true",
};

const withCors = (req: Request) => {
  const origin = req.headers.get("origin") || "*";
  return { ...baseHeaders, "Access-Control-Allow-Origin": origin };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 200, headers: withCors(req) });
}

export async function GET(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: withCors(req) });
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
    return NextResponse.json(data, { headers: withCors(req) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: withCors(req) });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireAuth(req);
    if (!session) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: withCors(req) });
    }
    const body = await req.json().catch(() => ({}));
    if (body.markAll) {
      await markAllNotificationsRead(session.user.id);
      return NextResponse.json({ ok: true }, { headers: withCors(req) });
    }
    if (!body.id) {
      return NextResponse.json({ error: "id obrigatorio" }, { status: 400, headers: withCors(req) });
    }
    await markNotificationRead(session.user.id, body.id);
    return NextResponse.json({ ok: true }, { headers: withCors(req) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500, headers: withCors(req) });
  }
}
