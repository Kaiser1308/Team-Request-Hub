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

type SortOption = "default" | "creator" | "assignee";

const sortOptions: SortOption[] = ["default", "creator", "assignee"];

const statusHeaderClassName: Record<RequestStatus, { header: string; count: string }> = {
  pending: {
    header: "border-[#d8d2cc] bg-[#f3f4f6] text-[#374151]",
    count: "border-[#d1d5db] bg-white text-[#374151]",
  },
  acknowledged: {
    header: "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
    count: "border-[#bfdbfe] bg-white text-[#1d4ed8]",
  },
  in_progress: {
    header: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]",
    count: "border-[#fde68a] bg-white text-[#b45309]",
  },
  done: {
    header: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
    count: "border-[#bbf7d0] bg-white text-[#15803d]",
  },
  cancelled: {
    header: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
    count: "border-[#fecaca] bg-white text-[#b91c1c]",
  },
};

function normalizeSearchValue(value: string) {
  return value.trim().toLocaleLowerCase();
}

function userLabel(user: InternalRequest["creator"] | undefined | null) {
  return user?.name ?? user?.email ?? "";
}

function assigneeLabel(request: InternalRequest) {
  const assigneeLabels = request.assignees
    ?.map((assignee) => userLabel(assignee))
    .filter(Boolean);

  if (assigneeLabels?.length) {
    return assigneeLabels.join(", ");
  }

  return userLabel(request.assignee);
}

function requestSearchText(request: InternalRequest) {
  return normalizeSearchValue(
    [
      request.title,
      request.description,
      userLabel(request.creator),
      assigneeLabel(request),
    ].join(" "),
  );
}

function compareOptionalText(left: string, right: string) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right, undefined, { sensitivity: "base" });
}

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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("default");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useRequests("all", limit);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = normalizeSearchValue(search);
    const nextRequests = (data ?? []).filter((request) => {
      const priorityMatches = priority === "all" || request.priority === priority;
      const searchMatches =
        normalizedSearch.length === 0 ||
        requestSearchText(request).includes(normalizedSearch);

      return priorityMatches && searchMatches;
    });

    if (sortBy === "creator") {
      return [...nextRequests].sort((left, right) =>
        compareOptionalText(userLabel(left.creator), userLabel(right.creator)),
      );
    }

    if (sortBy === "assignee") {
      return [...nextRequests].sort((left, right) =>
        compareOptionalText(assigneeLabel(left), assigneeLabel(right)),
      );
    }

    return nextRequests;
  }, [data, priority, search, sortBy]);

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
      <div className="grid gap-3 rounded-lg border border-[#e3ded8] bg-white p-3 shadow-[rgba(0,0,0,0.02)_0px_2px_8px] sm:grid-cols-[minmax(180px,1fr)_minmax(220px,2fr)_minmax(180px,1fr)]">
        <label className="grid min-w-0 gap-1 text-sm text-[#4b5563]">
          {t("list.priority")}
          <select
            className="h-10 w-full rounded-md border border-[#d8d2cc] bg-[#fbfaf9] px-3 text-sm text-[#111827] outline-none transition focus:border-[#097fe8] focus:bg-white focus:ring-2 focus:ring-[#097fe8]/15"
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

        <label className="grid min-w-0 gap-1 text-sm text-[#4b5563]">
          {t("list.searchAll")}
          <input
            type="search"
            className="h-10 w-full rounded-md border border-[#d8d2cc] bg-[#fbfaf9] px-3 text-sm text-[#111827] outline-none transition placeholder:text-[#9ca3af] focus:border-[#097fe8] focus:bg-white focus:ring-2 focus:ring-[#097fe8]/15"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("list.searchAllPlaceholder")}
          />
        </label>

        <label className="grid min-w-0 gap-1 text-sm text-[#4b5563]">
          {t("list.sortBy")}
          <select
            className="h-10 w-full rounded-md border border-[#d8d2cc] bg-[#fbfaf9] px-3 text-sm text-[#111827] outline-none transition focus:border-[#097fe8] focus:bg-white focus:ring-2 focus:ring-[#097fe8]/15"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortOption)}
          >
            {sortOptions.map((option) => (
              <option key={option} value={option}>
                {t(`list.sort${option === "default" ? "Default" : option === "creator" ? "Creator" : "Assignee"}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!data?.length ? (
        <div className="rounded-lg border border-[#e3ded8] bg-white p-6 text-sm text-[#615d59]">
          {emptyMessage}
        </div>
      ) : !filteredRequests.length ? (
        <div className="rounded-lg border border-[#e3ded8] bg-white p-6 text-sm text-[#615d59]">
          {t("empty.filtered")}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {statusColumns.map((status) => {
            const requests = groupedRequests[status];
            const statusHeaderClass = statusHeaderClassName[status];
            return (
              <section
                key={status}
                className="flex max-h-[calc(100vh-260px)] min-h-[520px] w-[340px] shrink-0 flex-col overflow-hidden rounded-lg border border-[#e3ded8] bg-[#f6f5f4] shadow-[rgba(0,0,0,0.025)_0px_2px_10px]"
              >
                <div
                  className={`flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2.5 ${statusHeaderClass.header}`}
                >
                  <h2 className="truncate text-section-title">
                    {translateStatus(t, status)}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-caption-strong ${statusHeaderClass.count}`}
                  >
                    {requests.length}
                  </span>
                </div>

                <div className="grid content-start gap-3 overflow-y-auto p-3 [scrollbar-color:#cfc7bf_transparent]">
                  {requests.length ? (
                    requests.map((request) => (
                      <RequestCard key={request.id} request={request} />
                    ))
                  ) : (
                    <div className="rounded-md border border-dashed border-[#d8d2cc] bg-[#fbfaf9] p-3 text-sm text-[#615d59]">
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
    <div className="flex gap-4 overflow-x-auto pb-3">
      {statusColumns.map((status) => (
        <div
          key={status}
          className="min-h-[520px] w-[340px] shrink-0 rounded-lg border border-[#e3ded8] bg-[#fbfaf9] p-3"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-[#ede8e3]" />
          <div className="mt-4 grid gap-3">
            <div className="h-28 animate-pulse rounded bg-[#ede8e3]" />
            <div className="h-28 animate-pulse rounded bg-[#ede8e3]" />
          </div>
        </div>
      ))}
    </div>
  );
}
