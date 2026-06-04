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
    ...assignmentHistory.map((item) => {
      const isRemoval = item.from_user_id && item.from_user_id === item.to_user_id;
      const removedUser = findUserLabel(activeUsersQuery.data, item.to_user_id);
      const byUser = findUserLabel(activeUsersQuery.data, item.assigned_by);

      if (isRemoval) {
        return {
          id: `assignment-${item.id}`,
          created_at: item.created_at,
          title: t("timeline.assigneeRemoved"),
          detail: item.reason
            ? `${byUser} removed ${removedUser}: ${item.reason}`
            : t("timeline.removedBy", { removed: removedUser, by: byUser }),
        };
      }

      return {
        id: `assignment-${item.id}`,
        created_at: item.created_at,
        title: t("timeline.assignmentChanged"),
        detail: item.reason ?? t("timeline.assignedTo", { user: findUserLabel(activeUsersQuery.data, item.to_user_id) }),
      };
    }),
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
      <div className="app-surface-muted rounded-lg p-4 text-body text-[#615d59]">
        {t("timeline.loading")}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-body text-red-700">
        {errorMessage}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="app-surface-muted rounded-lg p-4 text-body text-[#615d59]">
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div className="app-surface rounded-lg p-4">
      <h2 className="text-section-title text-[#111827]">{t("timeline.title")}</h2>
      <div className="mt-4 grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-[#d8d2cc] pl-4">
            <p className="text-body-medium text-[#111827]">{event.title}</p>
            <p className="mt-1 text-body text-[#4b5563]">{event.detail}</p>
            <p className="mt-1 text-caption text-[#615d59]">
              {formatDate(event.created_at, locale)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
