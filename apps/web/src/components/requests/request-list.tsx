"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RequestCard } from "@/components/requests/request-card";
import { Button } from "@/components/ui/button";
import { useRequests } from "@/hooks/use-requests";
import type { RequestView } from "@/lib/api/requests";
import type { RequestPriority, RequestStatus } from "@/types";

const statusOptions: Array<"all" | RequestStatus> = [
  "all",
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

function label(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function RequestList({
  view,
  emptyMessage,
  forbiddenMessage,
}: {
  view: RequestView;
  emptyMessage: string;
  forbiddenMessage?: string;
}) {
  const [status, setStatus] = useState<"all" | RequestStatus>("all");
  const [priority, setPriority] = useState<"all" | RequestPriority>("all");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useRequests(view);

  const filteredRequests = useMemo(() => {
    return (data ?? []).filter((request) => {
      const statusMatches = status === "all" || request.status === status;
      const priorityMatches =
        priority === "all" || request.priority === priority;
      return statusMatches && priorityMatches;
    });
  }, [data, priority, status]);

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-lg border border-[#e5e7eb] bg-white p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#f3f4f6]" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#f3f4f6]" />
            <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[#f3f4f6]" />
            <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-[#f3f4f6]" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const isForbidden =
      error instanceof Error &&
      (error.message.includes("403") || error.message.toLowerCase().includes("forbidden"));

    if (isForbidden) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {forbiddenMessage ?? "You do not have access to this request view."}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-700">
          {error instanceof Error ? error.message : "Could not load requests."}
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => void refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e7eb] bg-white p-3 sm:flex-row">
        <label className="grid gap-1 text-sm text-[#4b5563]">
          Status
          <select
            className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "all" | RequestStatus)
            }
          >
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {label(option)}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm text-[#4b5563]">
          Priority
          <select
            className="h-10 rounded-md border border-[#e5e7eb] bg-white px-3 text-sm text-[#111827]"
            value={priority}
            onChange={(event) =>
              setPriority(event.target.value as "all" | RequestPriority)
            }
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {label(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filteredRequests.length ? (
        <div className="rounded-lg border border-[#e5e7eb] bg-white p-6 text-sm text-[#6b7280]">
          <p>{data?.length ? "No requests match the selected filters." : emptyMessage}</p>
          {view === "created" && !data?.length ? (
            <Button type="button" variant="outline" className="mt-3" asChild>
              <Link href="/requests/new">Create a request</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3" aria-busy={isFetching}>
          {filteredRequests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
