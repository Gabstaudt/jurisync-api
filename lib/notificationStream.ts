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
  // eslint-disable-next-line no-var
  var __notificationUserUnsubscribe: Map<string, () => void> | undefined;
}

// Limite generoso: nao deve haver mais listeners simultaneos que usuarios ativos.
const MAX_LISTENERS = 500;

const emitter =
  global.__notificationEmitter ??
  (() => {
    const e = new EventEmitter();
    e.setMaxListeners(MAX_LISTENERS);
    return e;
  })();

if (!global.__notificationEmitter) {
  global.__notificationEmitter = emitter;
}

const userUnsubscribe =
  global.__notificationUserUnsubscribe ?? new Map<string, () => void>();

if (!global.__notificationUserUnsubscribe) {
  global.__notificationUserUnsubscribe = userUnsubscribe;
}

/**
 * Garante no maximo um stream SSE ativo por usuario: uma nova assinatura
 * fecha automaticamente a anterior do mesmo userId, evitando acumulo de
 * listeners "presos" (ex: abas antigas que nao fecharam a conexao).
 */
export function subscribeNotifications(
  userId: string,
  handler: (payload: NotificationPayload) => void,
): () => void {
  userUnsubscribe.get(userId)?.();

  emitter.on("notification", handler);
  const unsubscribe = () => {
    emitter.off("notification", handler);
    if (userUnsubscribe.get(userId) === unsubscribe) {
      userUnsubscribe.delete(userId);
    }
  };
  userUnsubscribe.set(userId, unsubscribe);
  return unsubscribe;
}

export function pushNotificationEvent(payload: NotificationPayload) {
  emitter.emit("notification", payload);
}

