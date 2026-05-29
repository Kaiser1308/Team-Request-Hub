import { apiFetch } from "@/lib/api/client";
import type { Notification, NotificationPreference } from "@/types";

export function listNotifications(unreadOnly = false) {
  const searchParams = new URLSearchParams({
    unread_only: String(unreadOnly),
  });
  return apiFetch<Notification[]>(
    `/notifications?${searchParams.toString()}`,
  );
}

export function markNotificationRead(notificationId: string) {
  return apiFetch<Notification>(`/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return apiFetch<{ updated: number }>("/notifications/read-all", {
    method: "POST",
  });
}

export function markNotificationsReadByType(types: string[]) {
  return apiFetch<{ updated: number }>("/notifications/read-by-type", {
    method: "POST",
    body: JSON.stringify({ types }),
  });
}

export type NotificationPreferenceUpdate = {
  telegram?: boolean;
  email?: boolean;
  web_push?: boolean;
};

export type BrowserPushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function listNotificationPreferences() {
  return apiFetch<NotificationPreference[]>("/notifications/preferences");
}

export function updateNotificationPreferences(body: NotificationPreferenceUpdate) {
  return apiFetch<NotificationPreference[]>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function getWebPushPublicKey() {
  return apiFetch<{ public_key: string }>("/notifications/web-push/vapid-public-key");
}

export function createWebPushSubscription(body: BrowserPushSubscriptionPayload) {
  return apiFetch<{ id: string; endpoint: string }>("/notifications/web-push/subscriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
