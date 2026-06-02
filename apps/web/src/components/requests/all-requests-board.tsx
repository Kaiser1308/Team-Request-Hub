"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RequestCard } from "@/components/requests/request-card";
import {
  translatePriority,
  translateStatus,
} from "@/components/requests/translated-labels";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useRequests } from "@/hooks/use-requests";
import type { InternalRequest, RequestPriority, RequestStatus } from "@/types";

const statusColumns: RequestStatus[] = [
  "pending",
  "acknowledged",
  "in_progress",
  "done",
  "cancelled",
];

const priorityOptions: Array<"all" | RequestPriority> = [
  "all",
  "low",
  "medium",
  "high",
  "urgent",
];

function groupRequestsByStatus(requests: InternalRequest[]) {
  return statusColumns.reduce<Record<RequestStatus, InternalRequest[]>>(
    (groups, status) => {
      groups[status] = requests.filter((request) => request.status === status);
      return groups;
    },
    {
      pending: [],
      acknowledged: [],
      in_progress: [],
      done: [],
      cancelled: [],
    },
  );
}

export function AllRequestsBoard({
  emptyMessage,
  forbiddenMessage,
  limit = 50,
}: {
  emptyMessage: string;
  forbiddenMessage: string;
  limit?: number;
}) {
  const t = useTranslations("requests");
  const [priority, setPriority] = useState<"all" | RequestPriority>("all");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useRequests("all", limit);

  const filteredRequests = useMemo(() => {
    return (data ?? []).filter((request) => {
      return priority === "all" || request.priority === priority;
    });
  }, [data, priority]);

  const groupedRequests = useMemo(
    () => groupRequestsByStatus(filteredRequests),
    [filteredRequests],
  );

  if (isLoading) {
    return <AllRequestsBoardSkeleton />;
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 403) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {forbiddenMessage ?? error.detail}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {error instanceof ApiError
            ? error.detail
            : error instanceof Error
              ? error.message
              : t("list.loadError")}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void refetch()}
        >
          {t("list.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isFetching}>
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-3">
        <label className="grid min-w-0 gap-1 text-sm text-[#4b5563] sm:max-w-48">
          {t("list.priority")}
          <select
            className="h-10 w-full rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as "all" | RequestPriority)
            }
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {translatePriority(t, option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data?.length ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
          {emptyMessage}
        </div>
      ) : !filteredRequests.length ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
          {t("empty.filtered")}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
          {statusColumns.map((status) => {
            const requests = groupedRequests[status];
            return (
              <section
                key={status}
                className="min-w-0 rounded-lg border border-[#e5e7eb] bg-[#f9fafb]"
              >
                <div className="flex items-center justify-between border-b border-[#e5e7eb] bg-white px-3 py-2">
                  <h2 className="text-section-title text-[#111827]">
                    {translateStatus(t, status)}
                  </h2>
                  <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-caption-strong text-[#4b5563]">
                    {requests.length}
                  </span>
                </div>

                <div className="grid gap-3 p-3">
                  {requests.length ? (
                    requests.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-[#d1d5db] bg-white p-3 text-sm text-[#6b7280]">
                      {t("empty.filtered")}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AllRequestsBoardSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
      {statusColumns.map((status) => (
        <div
          key={status}
          className="rounded-lg border border-[#e5e7eb] bg-white p-3"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#f3f4f6]" />
          <div className="mt-4 grid gap-3">
            <div className="h-28 animate-pulse rounded bg-[#f3f4f6]" />
            <div className="h-28 animate-pulse rounded bg-[#f3f4f6]" />
          </div>
        </div>
      ))}
    </div>
  );
}
