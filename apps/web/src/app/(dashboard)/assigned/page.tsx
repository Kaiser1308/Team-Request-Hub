"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RequestList } from "@/components/requests/request-list";
import { useRequests } from "@/hooks/use-requests";
import { cn } from "@/lib/utils";


type AssignedTab = "pending" | "acknowledged" | "in_progress";

const tabs: AssignedTab[] = ["pending", "acknowledged", "in_progress"];

export default function AssignedPage() {
  const t = useTranslations("requests");
  const [activeTab, setActiveTab] = useState<AssignedTab>("pending");
  const assignedQuery = useRequests("assigned");
  const tabCounts = useMemo(() => {
    return tabs.reduce<Record<AssignedTab, number>>(
      (counts, tab) => {
        counts[tab] =
          assignedQuery.data?.filter((request) => request.status === tab).length ?? 0;
        return counts;
      },
      { pending: 0, acknowledged: 0, in_progress: 0 },
    );
  }, [assignedQuery.data]);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold">{t("views.assignedTitle")}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("views.assignedDescription")}
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-[#e5e7eb] bg-white p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-[#111827] text-white"
                : "text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#111827]",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <span>{t(`assignedTabs.${tab}`)}</span>
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-5",
                  activeTab === tab
                    ? "bg-red-500 text-white"
                    : "bg-red-50 text-red-600",
                )}
              >
                {tabCounts[tab]}
              </span>
            </span>
          </button>
        ))}
      </div>

      <AssignedTabContent
        key={activeTab}
        status={activeTab}
        emptyMessage={t(`empty.assigned_${activeTab}`)}
      />
    </div>
  );
}

function AssignedTabContent({
  status,
  emptyMessage,
}: {
  status: AssignedTab;
  emptyMessage: string;
}) {
  return (
    <RequestList
      view="assigned"
      emptyMessage={emptyMessage}
      defaultStatus={status}
    />
  );
}
