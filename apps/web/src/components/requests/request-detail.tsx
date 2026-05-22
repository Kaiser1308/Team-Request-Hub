"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { formatUserSummaryLabel } from "@/components/requests/user-display";
import { Button } from "@/components/ui/button";
import {
  useRequest,
  useRequestAssignmentHistory,
  useRequestStatusLogs,
} from "@/hooks/use-requests";

function formatDate(value: string | null | undefined, locale: string, notSet: string) {
  if (!value) {
    return notSet;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const locale = useLocale();
  const t = useTranslations("requests");
  const tCommon = useTranslations("common");
  const requestQuery = useRequest(requestId);
  const assignmentHistoryQuery = useRequestAssignmentHistory(requestId);
  const statusLogsQuery = useRequestStatusLogs(requestId);

  if (requestQuery.isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
        <div className="h-56 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {requestQuery.error instanceof Error
            ? requestQuery.error.message
            : t("detail.loadError")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void requestQuery.refetch()}
        >
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  const request = requestQuery.data;

  return (
    <div className="space-y-5">
      <Button asChild variant="outline">
        <Link href="/requests">{t("detail.backToRequests")}</Link>
      </Button>

      <section className="rounded-lg border border-[#e5e7eb] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-[#111827]">
              {request.title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              {request.description}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <RequestStatusBadge status={request.status} />
            <RequestPriorityBadge priority={request.priority} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm text-[#4b5563] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.creator")}</p>
            <p>{formatUserSummaryLabel(request.creator) ?? request.created_by}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.created")}</p>
            <p>{formatDate(request.created_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.assigned")}</p>
            <p>{formatUserSummaryLabel(request.assignee) ?? request.assigned_to ?? tCommon("notSet")}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.updated")}</p>
            <p>{formatDate(request.updated_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.started")}</p>
            <p>{formatDate(request.started_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.done")}</p>
            <p>{formatDate(request.done_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">{t("detail.cancelled")}</p>
            <p>{formatDate(request.cancelled_at, locale, tCommon("notSet"))}</p>
          </div>
        </div>

        {request.reply ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">{t("detail.doneReply")}</p>
            <p className="mt-1 text-sm text-green-700">{request.reply}</p>
          </div>
        ) : null}

        <div className="mt-5 border-t border-[#e5e7eb] pt-4">
          <h2 className="text-sm font-semibold text-[#111827]">{t("detail.actions")}</h2>
          <RequestActions request={request} />
        </div>
      </section>

      <RequestTimeline
        assignmentHistory={assignmentHistoryQuery.data ?? []}
        statusLogs={statusLogsQuery.data ?? []}
        isLoading={assignmentHistoryQuery.isLoading || statusLogsQuery.isLoading}
        errorMessage={
          assignmentHistoryQuery.isError || statusLogsQuery.isError
            ? formatError(
                assignmentHistoryQuery.error ?? statusLogsQuery.error,
                t("detail.historyLoadError"),
              )
            : null
        }
      />
    </div>
  );
}
