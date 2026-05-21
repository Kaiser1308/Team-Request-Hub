"use client";

import Link from "next/link";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { findUserLabel } from "@/components/requests/user-display";
import { Button } from "@/components/ui/button";
import {
  useRequest,
  useRequestAssignmentHistory,
  useRequestStatusLogs,
} from "@/hooks/use-requests";
import { useActiveUsers } from "@/hooks/use-users";

function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RequestDetail({ requestId }: { requestId: string }) {
  const requestQuery = useRequest(requestId);
  const assignmentHistoryQuery = useRequestAssignmentHistory(requestId);
  const statusLogsQuery = useRequestStatusLogs(requestId);
  const activeUsersQuery = useActiveUsers();

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
            : "Could not load this request."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void requestQuery.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  const request = requestQuery.data;

  return (
    <div className="space-y-5">
      <Button asChild variant="outline">
        <Link href="/requests">Back to requests</Link>
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
            <p className="text-xs text-[#6b7280]">Created</p>
            <p>{formatDate(request.created_at)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Assigned</p>
            <p>{findUserLabel(activeUsersQuery.data, request.assigned_to)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Started</p>
            <p>{formatDate(request.started_at)}</p>
          </div>
          <div>
            <p className="text-xs text-[#6b7280]">Done</p>
            <p>{formatDate(request.done_at)}</p>
          </div>
        </div>

        {request.reply ? (
          <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-800">Done reply</p>
            <p className="mt-1 text-sm text-green-700">{request.reply}</p>
          </div>
        ) : null}

        <RequestActions request={request} />
      </section>

      <RequestTimeline
        assignmentHistory={assignmentHistoryQuery.data ?? []}
        statusLogs={statusLogsQuery.data ?? []}
      />
    </div>
  );
}
