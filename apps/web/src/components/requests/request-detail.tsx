"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AssigneeManagement } from "@/components/requests/assignee-management";
import { RequestActions } from "@/components/requests/request-actions";
import { AssigneeList } from "@/components/requests/assignee-list";
import { AttachmentList } from "@/components/requests/attachment-list";
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
import { useCurrentUser } from "@/hooks/use-current-user";

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
  const { data: currentUser } = useCurrentUser();

  if (requestQuery.isLoading) {
    return (
      <div className="grid gap-4">
        <div className="h-40 animate-pulse rounded-lg border border-[#e3ded8] bg-white" />
        <div className="h-56 animate-pulse rounded-lg border border-[#e3ded8] bg-white" />
      </div>
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-body-medium text-red-700">
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
  const assigneeIds = request.assignees?.map((assignee) => assignee.id) ?? [];
  const canManageAssignees = Boolean(
    currentUser &&
      request.status !== "done" &&
      request.status !== "cancelled" &&
      (currentUser.role === "lead" ||
        currentUser.id === request.created_by ||
        assigneeIds.includes(currentUser.id) ||
        currentUser.id === request.assigned_to),
  );

  return (
    <div className="space-y-4 sm:space-y-5">
      <Button asChild variant="outline">
        <Link href="/requests">{t("detail.backToRequests")}</Link>
      </Button>

      <section className="app-surface min-w-0 rounded-lg p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="break-words text-page-title text-[#111827]">
              {request.title}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <RequestStatusBadge status={request.status} />
            <RequestPriorityBadge priority={request.priority} />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-caption text-[#615d59] mb-1">{t("detail.description")}</p>
          <div className="app-surface-muted min-h-[80px] rounded-md p-3">
            <p className="whitespace-pre-wrap text-body text-[#4b5563]">
              {request.description}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-body text-[#4b5563] min-[390px]:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.creator")}</p>
            <p>{formatUserSummaryLabel(request.creator) ?? request.created_by}</p>
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.created")}</p>
            <p>{formatDate(request.created_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.assigned")}</p>
            <AssigneeList assignees={request.assignees} fallback={tCommon("notSet")} />
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.updated")}</p>
            <p>{formatDate(request.updated_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.started")}</p>
            <p>{formatDate(request.started_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.done")}</p>
            <p>{formatDate(request.done_at, locale, tCommon("notSet"))}</p>
          </div>
          <div>
            <p className="text-caption text-[#615d59]">{t("detail.cancelled")}</p>
            <p>{formatDate(request.cancelled_at, locale, tCommon("notSet"))}</p>
          </div>
        </div>

        {canManageAssignees ? <AssigneeManagement request={request} /> : null}

        {request.reply ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-body-medium text-green-800">{t("detail.doneReply")}</p>
            <p className="mt-1 text-body text-green-700">{request.reply}</p>
          </div>
        ) : null}

        <AttachmentList attachments={request.attachments} />

        <div className="mt-5 border-t border-[#eee9e4] pt-4">
          <h2 className="text-body-medium text-[#111827]">{t("detail.actions")}</h2>
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
