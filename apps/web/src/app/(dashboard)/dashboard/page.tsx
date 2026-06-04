"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { TelegramSettings } from "@/components/settings/telegram-settings";
import { UnreadCountBadge } from "@/components/shared/unread-count-badge";
import { translatePriority, translateStatus } from "@/components/requests/translated-labels";
import type { InternalRequest } from "@/types";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dedupeRequests(items: InternalRequest[]) {
  const map = new Map<string, InternalRequest>();

  for (const item of items) {
    const current = map.get(item.id);
    if (!current || new Date(item.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      map.set(item.id, item);
    }
  }

  return [...map.values()];
}

function recentRequests(items: InternalRequest[]) {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    )
    .slice(0, 6);
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const currentUserQuery = useCurrentUser();
  const summaryQuery = useDashboardSummary();

  const assignedItems = summaryQuery.data?.assigned_recent ?? [];
  const createdItems = summaryQuery.data?.created_recent ?? [];
  const pendingItems = summaryQuery.data?.pending_recent ?? [];
  const counts = summaryQuery.data?.counts;
  const notificationsUnread = summaryQuery.data?.notifications_unread ?? 0;

  const requestList = dedupeRequests([...assignedItems, ...createdItems, ...pendingItems]);
  const recentRequestItems = recentRequests(requestList);

  const isLoading = currentUserQuery.isLoading || summaryQuery.isLoading;

  const firstError = currentUserQuery.error || summaryQuery.error;

  const userName = currentUserQuery.data?.name ?? currentUserQuery.data?.email ?? t("teamMember");
  const role = currentUserQuery.data?.role;
  const isLead = role === "lead";

  if (isLoading) {
    return <div className="h-52 animate-pulse rounded-lg border border-[#e3ded8] bg-white" />;
  }

  if (firstError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {firstError instanceof Error ? firstError.message : t("loadError")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-page-title text-[#111827]">{t("title")}</h1>
        <div className="app-surface rounded-lg px-4 py-3">
          <p className="text-body-medium text-[#111827]">{userName}</p>
          <p className="text-caption text-[#615d59]">
            {role ? t("roleLabel", { role: role.toUpperCase() }) : t("rolePending")}
            {isLead ? ` - ${t("leadAccessEnabled")}` : ""}
          </p>
        </div>
      </div>

      <TelegramSettings />

      {isLead ? (
        <section className="grid gap-2 text-sm min-[390px]:grid-cols-2 sm:flex sm:flex-wrap">
          <Link href="/all" className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#e3ded8] bg-white px-3 py-2 text-center text-[#111827] hover:bg-[#fbfaf9] sm:justify-start">
            {t("allRequests")}
          </Link>
          <Link href="/admin/users" className="inline-flex min-h-10 items-center justify-center rounded-md border border-[#e3ded8] bg-white px-3 py-2 text-center text-[#111827] hover:bg-[#fbfaf9] sm:justify-start">
            {t("userManagement")}
          </Link>
        </section>
      ) : null}

      <section className="grid gap-2 min-[390px]:grid-cols-2 xl:grid-cols-5">
        {[
          { label: t("assigned"), value: counts?.assigned ?? 0, href: "/assigned" },
          { label: t("created"), value: counts?.created ?? 0, href: "/requests" },
          { label: t("pending"), value: counts?.pending ?? 0, href: "/assigned" },
          { label: t("done"), value: counts?.done ?? 0, href: "/done" },
          { label: t("urgent"), value: counts?.urgent ?? 0, href: "/assigned" },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="app-surface min-w-0 rounded-lg px-3 py-2.5 hover:bg-[#fbfaf9]">
            <p className="text-stat-label uppercase text-[#615d59]">{item.label}</p>
            <p className="mt-1 text-stat-value text-[#111827]">{item.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="app-surface rounded-lg">
          <div className="flex items-center justify-between border-b border-[#ede8e3] px-4 py-3">
            <h2 className="text-section-title text-[#111827]">{t("recentRequests")}</h2>
            <Link href="/assigned" className="text-link text-[#097fe8] hover:underline">
              {t("viewAssigned")}
            </Link>
          </div>
          {recentRequestItems.length ? (
            <div className="divide-y divide-[#ede8e3]">
              {recentRequestItems.map((request) => (
                <div key={request.id} className="min-w-0 space-y-1 px-4 py-3">
                  <Link href={`/requests/${request.id}`} className="line-clamp-1 text-body-medium text-[#111827] hover:text-[#097fe8]">
                    {request.title}
                  </Link>
                  <p className="break-words text-caption text-[#615d59]">
                    {translateStatus(t, request.status)} — {translatePriority(t, request.priority)} — {formatDate(request.updated_at, locale)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-body text-[#615d59]">{t("noRecentRequests")}</p>
          )}
        </div>

        <div className="app-surface rounded-lg">
          <div className="flex items-center justify-between border-b border-[#ede8e3] px-4 py-3">
            <h2 className="text-section-title text-[#111827]">{t("recentActivity")}</h2>
            <Link href="/notifications" className="text-link text-[#097fe8] hover:underline">
              {t("openNotifications")}
            </Link>
          </div>
          {notificationsUnread > 0 ? (
            <div className="flex items-center gap-2 px-4 py-3">
              <UnreadCountBadge count={notificationsUnread} showZero />
              <p className="text-body text-[#111827]">{t("unreadNotifications", { count: notificationsUnread })}</p>
            </div>
          ) : (
            <p className="px-4 py-5 text-body text-[#615d59]">{t("noUnreadNotifications")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
