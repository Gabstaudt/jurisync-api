import { q } from "./db";
import { pushNotificationEvent } from "./notificationStream";

export type NotificationType = "info" | "warning" | "success" | "error";

export async function createNotification(opts: {
  userId: string;
  ecosystemId: string;
  title: string;
  message: string;
  type?: NotificationType;
  actionUrl?: string | null;
}) {
  const { userId, ecosystemId, title, message, type = "info", actionUrl = null } = opts;
  const { rows } = await q(
    `INSERT INTO notifications (user_id, ecosystem_id, title, message, type, action_url)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [userId, ecosystemId, title, message, type, actionUrl],
  );
  const saved = rows[0];
  if (saved) {
    pushNotificationEvent({
      userId,
      data: {
        id: saved.id,
        title: saved.title,
        message: saved.message,
        type: saved.type,
        actionUrl: saved.action_url,
        isRead: saved.is_read,
        createdAt: saved.created_at,
      },
    });
  }
}

export async function listNotifications(userId: string) {
  const { rows } = await q(
    `SELECT * FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 100`,
    [userId],
  );
  return rows;
}

export async function markNotificationRead(userId: string, id: string) {
  await q(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
}

export async function markAllNotificationsRead(userId: string) {
  await q(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [userId]);
}
