"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { findUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import type { InternalRequest } from "@/types";

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestCard({ request }: { request: InternalRequest }) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const activeUsersQuery = useActiveUsers();

  const rawCreatorLabel = request.created_by
    ? findUserLabel(activeUsersQuery.data, request.created_by)
    : null;
  const creatorLabel = rawCreatorLabel ?? t("card.unassigned");

  const rawAssigneeLabel = request.assigned_to
    ? findUserLabel(activeUsersQuery.data, request.assigned_to)
    : null;
  const assigneeLabel = rawAssigneeLabel ?? t("card.unassigned");

  let timestampLabel: string;
  if (request.done_at) {
    timestampLabel = `${t("status.done")} ${formatDate(request.done_at, locale)}`;
  } else if (request.cancelled_at) {
    timestampLabel = `${t("status.cancelled")} ${formatDate(request.cancelled_at, locale)}`;
  } else if (request.started_at) {
    timestampLabel = `${t("status.in_progress")} ${formatDate(request.started_at, locale)}`;
  } else if (request.acknowledged_at) {
    timestampLabel = `${t("status.acknowledged")} ${formatDate(request.acknowledged_at, locale)}`;
  } else {
    timestampLabel = `${t("status.pending")} ${formatDate(request.created_at, locale)}`;
  }

  let actionLabel: string | null = null;
  if (request.status === "pending") {
    actionLabel = request.assigned_to
      ? t("card.acknowledge")
      : t("card.selfAssign");
  } else if (request.status === "acknowledged") {
    actionLabel = t("card.start");
  } else if (request.status === "in_progress") {
    actionLabel = t("card.markDone");
  }

  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-[#111827]">
            {request.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#6b7280]">
        <span>{t("card.creator", { name: creatorLabel })}</span>
        <span>{t("card.assignee", { name: assigneeLabel })}</span>
        <span>{timestampLabel}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4b5563]">
        {request.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f3f4f6] pt-3">
        <div className="min-h-5 text-xs text-[#4b5563]">
          {actionLabel
            ? t("card.nextAction", { action: actionLabel })
            : t("card.noFurtherAction")}
        </div>
        <Link
          href={`/requests/${request.id}`}
          className="shrink-0 text-xs font-medium text-[#2563eb] hover:underline"
        >
          {t("card.viewDetails")}
        </Link>
      </div>

      <RequestActions request={request} />
    </article>
  );
}
