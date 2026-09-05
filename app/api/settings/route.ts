import { NextRequest, NextResponse } from "next/server";
import { q } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const H = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

type NotificationSettings = {
  emailEnabled: boolean;
  contractExpiry: boolean;
  weeklyReport: boolean;
  commentNotifications: boolean;
  daysBeforeExpiry: number;
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  emailEnabled: true,
  contractExpiry: true,
  weeklyReport: true,
  commentNotifications: true,
  daysBeforeExpiry: 7,
};

const normalizeNotifications = (value: any): NotificationSettings => {
  const n = value || {};
  const days =
    typeof n.daysBeforeExpiry === "number"
      ? n.daysBeforeExpiry
      : parseInt(String(n.daysBeforeExpiry || "7"), 10);
  return {
    emailEnabled: n.emailEnabled !== undefined ? Boolean(n.emailEnabled) : true,
    contractExpiry:
      n.contractExpiry !== undefined ? Boolean(n.contractExpiry) : true,
    weeklyReport:
      n.weeklyReport !== undefined ? Boolean(n.weeklyReport) : true,
    commentNotifications:
      n.commentNotifications !== undefined
        ? Boolean(n.commentNotifications)
        : true,
    daysBeforeExpiry:
      Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 7,
  };
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: H });
}

export async function GET(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }

  const { rows } = await q(
    "SELECT notifications FROM user_settings WHERE user_id = $1 AND ecosystem_id = $2",
    [session.user.id, session.user.ecosystemId],
  );
  const notifications = rows[0]?.notifications
    ? normalizeNotifications(rows[0].notifications)
    : DEFAULT_NOTIFICATIONS;

  return NextResponse.json({ notifications }, { headers: H });
}

export async function PATCH(req: NextRequest) {
  const session = await requireAuth(req);
  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401, headers: H });
  }
  const body = await req.json().catch(() => ({}));
  const notifications = normalizeNotifications(body?.notifications);

  await q(
    `INSERT INTO user_settings (user_id, ecosystem_id, notifications, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (user_id)
     DO UPDATE SET notifications = EXCLUDED.notifications, updated_at = NOW()`,
    [session.user.id, session.user.ecosystemId, notifications],
  );

  return NextResponse.json({ notifications }, { headers: H });
}
