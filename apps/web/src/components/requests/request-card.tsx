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

export function RequestCard({ request }: { request: InternalRequest }) {
  const activeUsersQuery = useActiveUsers();

  return (
    <article className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            href={`/requests/${request.id}`}
            className="text-base font-semibold text-[#111827] hover:underline"
          >
            {request.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[#4b5563]">
            {request.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <RequestStatusBadge status={request.status} />
          <RequestPriorityBadge priority={request.priority} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#6b7280]">
        <span>Created {formatDate(request.created_at)}</span>
        <span>{findUserLabel(activeUsersQuery.data, request.assigned_to)}</span>
        {request.done_at ? <span>Done {formatDate(request.done_at)}</span> : null}
      </div>

      {request.tags.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {request.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-[#f3f4f6] px-2 py-1 text-xs text-[#4b5563]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <RequestActions request={request} />
    </article>
  );
}
