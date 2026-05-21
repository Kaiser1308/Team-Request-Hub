"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  useNotificationActions,
  useNotifications,
} from "@/hooks/use-notifications";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationList() {
  const notificationsQuery = useNotifications(false);
  const actions = useNotificationActions();
  const notifications = notificationsQuery.data ?? [];
  const unreadCount = notifications.filter((item) => !item.is_read).length;

  if (notificationsQuery.isLoading) {
    return (
      <div className="space-y-2 rounded-lg border border-[#e5e7eb] bg-white p-3">
        <div className="h-4 w-40 animate-pulse rounded bg-[#f3f4f6]" />
        <div className="h-10 animate-pulse rounded bg-[#f3f4f6]" />
        <div className="h-10 animate-pulse rounded bg-[#f3f4f6]" />
      </div>
    );
  }

  if (notificationsQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {notificationsQuery.error instanceof Error
            ? notificationsQuery.error.message
            : "Could not load notifications."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void notificationsQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!notifications.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        No notifications yet. New request activity and status updates will appear here.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-3 py-2">
        <p className="text-sm font-medium text-[#111827]">
          {unreadCount} unread
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!unreadCount || actions.markAllRead.isPending}
          onClick={() => actions.markAllRead.mutate()}
        >
          {actions.markAllRead.isPending ? "Marking..." : "Mark all read"}
        </Button>
      </div>

      <div className="divide-y divide-[#e5e7eb]">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-xs text-[#6b7280]">
                {notification.is_read ? "Read" : "Unread"}
              </p>
              <p className="text-sm text-[#111827]">{notification.message}</p>
              <p className="mt-1 text-xs text-[#6b7280]">
                {formatDate(notification.created_at)}
              </p>
              {notification.request_id ? (
                <Link
                  href={`/requests/${notification.request_id}`}
                  className="mt-1 inline-flex text-xs text-blue-700 hover:underline"
                >
                  View request
                </Link>
              ) : null}
            </div>
            {!notification.is_read ? (
              <Button
                type="button"
                variant="outline"
                disabled={actions.markRead.isPending}
                onClick={() => actions.markRead.mutate(notification.id)}
              >
                {actions.markRead.isPending ? "Saving..." : "Mark read"}
              </Button>
            ) : (
              <span className="text-xs text-[#6b7280]">Read</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
