"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AssigneeList } from "@/components/requests/assignee-list";
import { formatUserSummaryLabel } from "@/components/requests/user-display";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
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

  const creatorLabel =
    formatUserSummaryLabel(request.creator) ?? t("card.unassigned");
  const hasAssignees = Boolean(
    (request.assignees?.length ?? 0) > 0 || request.assigned_to,
  );

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
    actionLabel = hasAssignees
      ? t("card.acknowledge")
      : t("card.selfAssign");
  } else if (request.status === "acknowledged") {
    actionLabel = t("card.start");
  } else if (request.status === "in_progress") {
    actionLabel = t("card.markDone");
  }

  return (
    <article className="min-w-0 rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex flex-col gap-2 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-card-title text-[#111827]">
            {request.title}
          </h3>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 min-[390px]:justify-end">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 break-words text-caption text-[#6b7280]">
        <span>{t("card.creator", { name: creatorLabel })}</span>
        <span className="inline-flex items-center gap-1">
          {t("card.assignee", { name: "" })}
          <AssigneeList
            assignees={request.assignees}
            fallback={t("card.unassigned")}
          />
        </span>
        <span>{timestampLabel}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-body text-[#4b5563]">
        {request.description}
      </p>

      <div className="mt-3 grid gap-2 border-t border-[#f3f4f6] pt-3 min-[390px]:flex min-[390px]:items-center min-[390px]:justify-between min-[390px]:gap-3">
        <div className="min-h-5 text-caption text-[#4b5563]">
          {actionLabel
            ? t("card.nextAction", { action: actionLabel })
            : t("card.noFurtherAction")}
        </div>
        <Link
          href={`/requests/${request.id}`}
          className="inline-flex min-h-9 items-center justify-center rounded-md text-link text-[#2563eb] hover:underline min-[390px]:shrink-0 min-[390px]:justify-start"
        >
          {t("card.viewDetails")}
        </Link>
      </div>
    </article>
  );
}
