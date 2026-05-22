"use client";

import { useLocale, useTranslations } from "next-intl";
import { findUserLabel } from "@/components/requests/user-display";
import { translateStatus } from "@/components/requests/translated-labels";
import { useActiveUsers } from "@/hooks/use-users";
import type { AssignmentHistory, RequestStatusLog } from "@/types";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestTimeline({
  assignmentHistory,
  statusLogs,
  isLoading = false,
  errorMessage = null,
}: {
  assignmentHistory: AssignmentHistory[];
  statusLogs: RequestStatusLog[];
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("requests");
  const activeUsersQuery = useActiveUsers();

  const events = [
    ...assignmentHistory.map((item) => ({
      id: `assignment-${item.id}`,
      created_at: item.created_at,
      title: t("timeline.assignmentChanged"),
      detail: item.reason ?? t("timeline.assignedTo", { user: findUserLabel(activeUsersQuery.data, item.to_user_id) }),
    })),
    ...statusLogs.map((item) => ({
      id: `status-${item.id}`,
      created_at: item.created_at,
      title: t("timeline.statusChanged"),
      detail: t("timeline.statusChangeDetail", {
        from: item.from_status ? translateStatus(t, item.from_status) : translateStatus(t, "new"),
        to: translateStatus(t, item.to_status),
      }),
    })),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        {t("timeline.loading")}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <h2 className="text-base font-semibold">{t("timeline.title")}</h2>
      <div className="mt-4 grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-[#e5e7eb] pl-4">
            <p className="text-sm font-medium text-[#111827]">{event.title}</p>
            <p className="mt-1 text-sm text-[#4b5563]">{event.detail}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
              {formatDate(event.created_at, locale)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
