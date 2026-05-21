"use client";

import { findUserLabel } from "@/components/requests/user-display";
import { useActiveUsers } from "@/hooks/use-users";
import type { AssignmentHistory, RequestStatusLog } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RequestTimeline({
  assignmentHistory,
  statusLogs,
}: {
  assignmentHistory: AssignmentHistory[];
  statusLogs: RequestStatusLog[];
}) {
  const activeUsersQuery = useActiveUsers();

  const events = [
    ...assignmentHistory.map((item) => ({
      id: `assignment-${item.id}`,
      created_at: item.created_at,
      title: "Assignment changed",
      detail: item.reason ?? `Assigned to ${findUserLabel(activeUsersQuery.data, item.to_user_id)}`,
    })),
    ...statusLogs.map((item) => ({
      id: `status-${item.id}`,
      created_at: item.created_at,
      title: "Status changed",
      detail: `${item.from_status ?? "new"} -> ${item.to_status}`,
    })),
  ].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );

  if (!events.length) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 text-sm text-[#6b7280]">
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
      <h2 className="text-base font-semibold">Timeline</h2>
      <div className="mt-4 grid gap-4">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-[#e5e7eb] pl-4">
            <p className="text-sm font-medium text-[#111827]">{event.title}</p>
            <p className="mt-1 text-sm text-[#4b5563]">{event.detail}</p>
            <p className="mt-1 text-xs text-[#6b7280]">
              {formatDate(event.created_at)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
