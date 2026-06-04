"use client";

import { animate, stagger } from "animejs";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { RequestCard } from "@/components/requests/request-card";
import { AppSelect } from "@/components/ui/app-select";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import {
  translatePriority,
  translateStatus,
} from "@/components/requests/translated-labels";
import { useRequests } from "@/hooks/use-requests";
import {
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_OFFSET,
  MOTION_STAGGER,
} from "@/lib/animation/constants";
import type { RequestView } from "@/lib/api/requests";
import type { InternalRequest, RequestPriority, RequestStatus } from "@/types";

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

export function RequestList({
  view,
  emptyMessage,
  forbiddenMessage,
  limit = 50,
  defaultStatus = "all",
}: {
  view: RequestView;
  emptyMessage: string;
  forbiddenMessage?: string;
  limit?: number;
  defaultStatus?: "all" | RequestStatus;
}) {
  const t = useTranslations("requests");
  const [status, setStatus] = useState<"all" | RequestStatus>(defaultStatus);
  const [priority, setPriority] = useState<"all" | RequestPriority>("all");
  const { data, isLoading, isError, error, refetch, isFetching } =
    useRequests(view, limit);

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
          <div
            key={index}
            className="app-surface rounded-lg p-4"
          >
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#ede8e3]" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#ede8e3]" />
            <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-[#ede8e3]" />
            <div className="mt-4 h-3 w-1/2 animate-pulse rounded bg-[#ede8e3]" />
          </div>
        ))}
      </div>
    );
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
          {error instanceof ApiError ? error.detail : (error instanceof Error ? error.message : t("list.loadError"))}
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
    <div className="space-y-4">
      <div className="app-filter-surface grid gap-3 rounded-lg p-3 sm:flex sm:flex-row">
        {defaultStatus === "all" ? (
          <label className="grid min-w-0 gap-1 text-sm text-[#615d59] sm:min-w-40">
            {t("list.status")}
            <AppSelect
              value={status}
              onChange={(v) => setStatus(v)}
              options={statusOptions.map((option) => ({
                value: option,
                label: translateStatus(t, option),
              }))}
            />
          </label>
        ) : null}

        <label className="grid min-w-0 gap-1 text-sm text-[#615d59] sm:min-w-40">
          {t("list.priority")}
          <AppSelect
            value={priority}
            onChange={(v) => setPriority(v)}
            options={priorityOptions.map((option) => ({
              value: option,
              label: translatePriority(t, option),
            }))}
          />
        </label>
      </div>

      {!filteredRequests.length ? (
        <div className="app-surface-muted rounded-lg p-6 text-body text-[#615d59]">
          <p>
            {data?.length
              ? t("empty.filtered")
              : emptyMessage}
          </p>
          {view === "created" && !data?.length ? (
            <Button type="button" variant="outline" className="mt-3" asChild>
              <Link href="/requests/new">{t("list.createRequest")}</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <RequestCards isFetching={isFetching} requests={filteredRequests} />
      )}
    </div>
  );
}

function RequestCards({
  isFetching,
  requests,
}: {
  isFetching: boolean;
  requests: InternalRequest[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !requests.length) {
      return;
    }

    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-request-card]"),
    );

    if (!targets.length) {
      return;
    }

    const animation = animate(targets, {
      y: [MOTION_OFFSET.card, 0],
      opacity: [0, 1],
      duration: MOTION_DURATION.normal,
      delay: stagger(MOTION_STAGGER.normal, { from: "first" }),
      ease: MOTION_EASE.entrance,
      autoplay: true,
    });

    return () => {
      animation.pause();
    };
  }, [requests]);

  return (
    <div ref={containerRef} className="grid gap-3" aria-busy={isFetching}>
      {requests.map((request) => (
        <div key={request.id} data-request-card>
          <RequestCard request={request} />
        </div>
      ))}
    </div>
  );
}
