"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
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
  const poolItems = summaryQuery.data?.pool_recent ?? [];
  const counts = summaryQuery.data?.counts;
  const notificationsUnread = summaryQuery.data?.notifications_unread ?? 0;

  const requestList = dedupeRequests([...assignedItems, ...createdItems, ...poolItems]);
  const recentRequestItems = recentRequests(requestList);

  const isLoading = currentUserQuery.isLoading || summaryQuery.isLoading;

  const firstError = currentUserQuery.error || summaryQuery.error;

  const userName = currentUserQuery.data?.name ?? currentUserQuery.data?.email ?? t("teamMember");
  const role = currentUserQuery.data?.role;
  const isLead = role === "lead";

  if (isLoading) {
    return <div className="h-52 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />;
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
        <h1 className="text-2xl font-semibold text-[#111827]">{t("title")}</h1>
        <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
          <p className="text-sm font-medium text-[#111827]">{userName}</p>
          <p className="text-xs text-[#6b7280]">
            {role ? t("roleLabel", { role: role.toUpperCase() }) : t("rolePending")}
            {isLead ? ` - ${t("leadAccessEnabled")}` : ""}
          </p>
        </div>
      </div>

      {isLead ? (
        <section className="flex flex-wrap gap-2 text-sm">
          <Link href="/all" className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-[#111827] hover:bg-[#f9fafb]">
            {t("allRequests")}
          </Link>
          <Link href="/admin/users" className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-[#111827] hover:bg-[#f9fafb]">
            {t("userManagement")}
          </Link>
        </section>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: t("assigned"), value: counts?.assigned ?? assignedItems.length },
          { label: t("created"), value: counts?.created ?? createdItems.length },
          { label: t("pool"), value: counts?.pool ?? poolItems.length },
          { label: t("done"), value: counts?.done ?? 0 },
          { label: t("urgent"), value: counts?.urgent ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-normal text-[#6b7280]">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-[#111827]">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
            <h2 className="text-base font-semibold text-[#111827]">{t("recentRequests")}</h2>
            <Link href="/assigned" className="text-xs font-medium text-[#2563eb] hover:underline">
              {t("viewAssigned")}
            </Link>
          </div>
          {recentRequestItems.length ? (
            <div className="divide-y divide-[#e5e7eb]">
              {recentRequestItems.map((request) => (
                <div key={request.id} className="space-y-1 px-4 py-3">
                  <Link href={`/requests/${request.id}`} className="line-clamp-1 text-sm font-medium text-[#111827] hover:text-[#2563eb]">
                    {request.title}
                  </Link>
                  <p className="text-xs text-[#6b7280]">
                    {translateStatus(t, request.status)} — {translatePriority(t, request.priority)} — {formatDate(request.updated_at, locale)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[#6b7280]">{t("noRecentRequests")}</p>
          )}
        </div>

        <div className="rounded-lg border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
            <h2 className="text-base font-semibold text-[#111827]">{t("recentActivity")}</h2>
            <Link href="/notifications" className="text-xs font-medium text-[#2563eb] hover:underline">
              {t("openNotifications")}
            </Link>
          </div>
          {notificationsUnread > 0 ? (
            <div className="px-4 py-3">
              <p className="text-sm text-[#111827]">{t("unreadNotifications", { count: notificationsUnread })}</p>
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[#6b7280]">{t("noUnreadNotifications")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
