"use client";

import { animate, stagger } from "animejs";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  useNotificationActions,
  useNotifications,
} from "@/hooks/use-notifications";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_STAGGER,
} from "@/lib/animation/constants";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationList() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const notificationsQuery = useNotifications(false);
  const actions = useNotificationActions();
  const listRef = useRef<HTMLDivElement | null>(null);
  const notifications = notificationsQuery.data;
  const notificationItems = notifications ?? [];
  const unreadCount = notificationItems.filter((item) => !item.is_read).length;

  useEffect(() => {
    const container = listRef.current;
    if (!container || !notificationItems.length) {
      return;
    }

    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-notification-item]"),
    );
    if (!targets.length) {
      return;
    }

    const animation = animate(targets, {
      x: [MOTION_OFFSET.tiny, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.normal,
      delay: stagger(MOTION_STAGGER.tight, { from: "first" }),
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [notificationItems.length]);

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
            : t("loadError")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void notificationsQuery.refetch()}
        >
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  if (!notificationItems.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        {t("empty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5e7eb] px-3 py-2">
        <p className="text-sm font-medium text-[#111827]">
          {t("unreadCount", { count: unreadCount })}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={!unreadCount || actions.markAllRead.isPending}
          onClick={() => actions.markAllRead.mutate()}
        >
          {actions.markAllRead.isPending ? t("marking") : t("markAllRead")}
        </Button>
      </div>

      <div ref={listRef} className="divide-y divide-[#e5e7eb]">
        {notificationItems.map((notification) => (
          <div
            key={notification.id}
            data-notification-item
            className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <p className="text-xs text-[#6b7280]">
                {notification.is_read ? t("read") : t("unread")}
              </p>
              <p className="text-sm text-[#111827]">{notification.message}</p>
              <p className="mt-1 text-xs text-[#6b7280]">
                {formatDate(notification.created_at, locale)}
              </p>
              {notification.request_id ? (
                <Link
                  href={`/requests/${notification.request_id}`}
                  className="mt-1 inline-flex text-xs text-blue-700 hover:underline"
                >
                  {t("viewRequest")}
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
                {actions.markRead.isPending ? t("saving") : t("markRead")}
              </Button>
            ) : (
              <span className="text-xs text-[#6b7280]">{t("read")}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
