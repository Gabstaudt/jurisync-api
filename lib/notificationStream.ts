import { EventEmitter } from "events";

type NotificationPayload = {
  userId: string;
  data: {
    id: string;
    title: string;
    message: string;
    type: string;
    actionUrl?: string | null;
    isRead: boolean;
    createdAt: string;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __notificationEmitter: EventEmitter | undefined;
}

const emitter =
  global.__notificationEmitter ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    return e;
  })();

if (!global.__notificationEmitter) {
  global.__notificationEmitter = emitter;
}

export function subscribeNotifications(
  handler: (payload: NotificationPayload) => void,
): () => void {
  emitter.on("notification", handler);
  return () => {
    emitter.off("notification", handler);
  };
}

export function pushNotificationEvent(payload: NotificationPayload) {
  emitter.emit("notification", payload);
}

