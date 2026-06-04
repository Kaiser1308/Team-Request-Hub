"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Clock3,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
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
  const creatorCompact =
    request.creator?.name ?? request.creator?.email ?? creatorLabel;
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
    <Link
      href={`/requests/${request.id}`}
      aria-label={`${t("card.viewDetails")}: ${request.title}`}
      className="group block min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#097fe8] focus-visible:ring-offset-2"
    >
      <article className="min-w-0 overflow-hidden rounded-lg border border-[#e3ded8] bg-white shadow-[rgba(0,0,0,0.035)_0px_3px_14px,rgba(0,0,0,0.018)_0px_1px_3px] transition group-hover:-translate-y-0.5 group-hover:border-[#cfc7bf] group-hover:shadow-[rgba(0,0,0,0.055)_0px_9px_24px,rgba(0,0,0,0.025)_0px_2px_6px]">
        <div className="grid min-w-0 gap-3 p-3.5">
          <div className="grid min-w-0 gap-1.5">
            <h3 className="line-clamp-2 min-w-0 break-words text-card-title text-[#111827]">
              {request.title}
            </h3>
            <p className="line-clamp-2 min-h-10 break-words text-body text-[#615d59]">
              {request.description}
            </p>
          </div>

          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-1">
              <RequestStatusBadge status={request.status} />
              <RequestPriorityBadge priority={request.priority} />
            </div>
            <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#e3ded8] bg-[#fbfaf9] text-[#097fe8] transition group-hover:border-[#b8d8f2] group-hover:bg-[#f2f9ff]">
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </span>
          </div>

          <div className="grid min-w-0 gap-1.5 rounded-md border border-[#ede8e3] bg-[#fbfaf9] px-2.5 py-2">
            <KanbanInfoLine icon={UserRound}>
              <span className="truncate">{creatorCompact}</span>
            </KanbanInfoLine>
            <KanbanInfoLine icon={UsersRound}>
              <AssigneeList
                assignees={request.assignees}
                fallback={t("card.unassigned")}
                variant="compact"
              />
            </KanbanInfoLine>
            <KanbanInfoLine icon={Clock3}>
              <span className="truncate">{timestampLabel}</span>
            </KanbanInfoLine>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 border-t border-[#eee9e4] pt-3">
            <span className="min-w-0 truncate text-caption text-[#615d59]">
              {actionLabel ?? t("card.noFurtherAction")}
            </span>
            <span className="shrink-0 text-link text-[#097fe8]">
              {t("card.viewDetails")}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

function KanbanInfoLine({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-caption text-[#615d59]">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-[#a39e98]" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
