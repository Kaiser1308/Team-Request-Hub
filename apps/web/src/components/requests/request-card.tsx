"use client";

import Link from "next/link";
import { RequestActions } from "@/components/requests/request-actions";
import { RequestPriorityBadge } from "@/components/requests/request-priority-badge";
import { RequestStatusBadge } from "@/components/requests/request-status-badge";
import { findUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import type { InternalRequest } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getRelevantTimestamp(request: InternalRequest) {
  if (request.done_at) return `Done ${formatDate(request.done_at)}`;
  if (request.cancelled_at) return `Cancelled ${formatDate(request.cancelled_at)}`;
  if (request.started_at) return `Started ${formatDate(request.started_at)}`;
  if (request.acknowledged_at) return `Acknowledged ${formatDate(request.acknowledged_at)}`;
  return `Created ${formatDate(request.created_at)}`;
}

function getNextActionLabel(request: InternalRequest) {
  if (request.status === "pending") {
    return request.assigned_to ? "Acknowledge" : "Self assign";
  }

  if (request.status === "acknowledged") {
    return "Start";
  }

  if (request.status === "in_progress") {
    return "Mark done";
  }

  return null;
}

export function RequestCard({ request }: { request: InternalRequest }) {
  const activeUsersQuery = useActiveUsers();
  const creatorLabel = findUserLabel(activeUsersQuery.data, request.created_by);
  const assigneeLabel = findUserLabel(activeUsersQuery.data, request.assigned_to);
  const nextAction = getNextActionLabel(request);

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
        <span>Creator: {creatorLabel}</span>
        <span>Assignee: {assigneeLabel}</span>
        <span>{getRelevantTimestamp(request)}</span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#4b5563]">
        {request.description}
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#f3f4f6] pt-3">
        <div className="min-h-5 text-xs text-[#4b5563]">
          {nextAction ? `Next action: ${nextAction}` : "No further action"}
        </div>
        <Link
          href={`/requests/${request.id}`}
          className="shrink-0 text-xs font-medium text-[#2563eb] hover:underline"
        >
          View details
        </Link>
      </div>

      <RequestActions request={request} />
    </article>
  );
}
