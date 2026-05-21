"use client";

import Link from "next/link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNotifications } from "@/hooks/use-notifications";
import { useRequests } from "@/hooks/use-requests";
import type { InternalRequest, Notification } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dedupeRequests(items: InternalRequest[]) {
  const map = new Map<string, InternalRequest>();

  for (const item of items) {
    const current = map.get(item.id);
    if (!current || new Date(item.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      map.set(item.id, item);
    }
  }

  return [...map.values()];
}

function recentRequests(items: InternalRequest[]) {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    )
    .slice(0, 6);
}

function recentNotifications(items: Notification[]) {
  return [...items]
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, 6);
}

export default function DashboardPage() {
  const currentUserQuery = useCurrentUser();
  const assignedQuery = useRequests("assigned");
  const createdQuery = useRequests("created");
  const poolQuery = useRequests("pool");
  const doneQuery = useRequests("done");
  const notificationsQuery = useNotifications(false);

  const assignedItems = assignedQuery.data ?? [];
  const createdItems = createdQuery.data ?? [];
  const poolItems = poolQuery.data ?? [];
  const doneItems = doneQuery.data ?? [];
  const notifications = notificationsQuery.data ?? [];

  const requestList = dedupeRequests([
    ...assignedItems,
    ...createdItems,
    ...poolItems,
    ...doneItems,
  ]);
  const urgentCount = requestList.filter((item) => item.priority === "urgent").length;
  const recentRequestItems = recentRequests(requestList);
  const recentActivity = recentNotifications(notifications);

  const isLoading =
    currentUserQuery.isLoading ||
    assignedQuery.isLoading ||
    createdQuery.isLoading ||
    poolQuery.isLoading ||
    doneQuery.isLoading ||
    notificationsQuery.isLoading;

  const firstError =
    currentUserQuery.error ||
    assignedQuery.error ||
    createdQuery.error ||
    poolQuery.error ||
    doneQuery.error ||
    notificationsQuery.error;

  const userName = currentUserQuery.data?.name ?? currentUserQuery.data?.email ?? "Team member";
  const role = currentUserQuery.data?.role;
  const isLead = role === "lead";

  if (isLoading) {
    return <div className="h-52 animate-pulse rounded-lg border border-[#e5e7eb] bg-white" />;
  }

  if (firstError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {firstError instanceof Error ? firstError.message : "Could not load dashboard data."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold text-[#111827]">Dashboard</h1>
        <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
          <p className="text-sm font-medium text-[#111827]">{userName}</p>
          <p className="text-xs text-[#6b7280]">
            {role ? `Role: ${role.toUpperCase()}` : "Role pending"}
            {isLead ? " - lead access enabled" : ""}
          </p>
        </div>
      </div>

      {isLead ? (
        <section className="flex flex-wrap gap-2 text-sm">
          <Link href="/all" className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-[#111827] hover:bg-[#f9fafb]">
            All requests
          </Link>
          <Link href="/admin/users" className="rounded-md border border-[#d1d5db] bg-white px-3 py-2 text-[#111827] hover:bg-[#f9fafb]">
            User management
          </Link>
        </section>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Assigned", value: assignedItems.length },
          { label: "Created", value: createdItems.length },
          { label: "Pool", value: poolItems.length },
          { label: "Done", value: doneItems.length },
          { label: "Urgent", value: urgentCount },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-2.5">
            <p className="text-[11px] font-medium uppercase tracking-normal text-[#6b7280]">{item.label}</p>
            <p className="mt-1 text-xl font-semibold text-[#111827]">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
            <h2 className="text-base font-semibold text-[#111827]">Recent requests</h2>
            <Link href="/assigned" className="text-xs font-medium text-[#2563eb] hover:underline">
              View assigned
            </Link>
          </div>
          {recentRequestItems.length ? (
            <div className="divide-y divide-[#e5e7eb]">
              {recentRequestItems.map((request) => (
                <div key={request.id} className="space-y-1 px-4 py-3">
                  <Link href={`/requests/${request.id}`} className="line-clamp-1 text-sm font-medium text-[#111827] hover:text-[#2563eb]">
                    {request.title}
                  </Link>
                  <p className="text-xs text-[#6b7280]">
                    {request.status.replaceAll("_", " ")} - {request.priority} - {formatDate(request.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[#6b7280]">No recent requests yet.</p>
          )}
        </div>

        <div className="rounded-lg border border-[#e5e7eb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
            <h2 className="text-base font-semibold text-[#111827]">Recent activity</h2>
            <Link href="/notifications" className="text-xs font-medium text-[#2563eb] hover:underline">
              Open notifications
            </Link>
          </div>
          {recentActivity.length ? (
            <div className="divide-y divide-[#e5e7eb]">
              {recentActivity.map((item) => (
                <div key={item.id} className="space-y-1 px-4 py-3">
                  <p className="text-sm text-[#111827]">{item.message}</p>
                  <p className="text-xs text-[#6b7280]">{formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-5 text-sm text-[#6b7280]">No recent activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
