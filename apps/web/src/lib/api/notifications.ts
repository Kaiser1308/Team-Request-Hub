import { apiFetch } from "@/lib/api/client";
import type { Notification } from "@/types";

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
