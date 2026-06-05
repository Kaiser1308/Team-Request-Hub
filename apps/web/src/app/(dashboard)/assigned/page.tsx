"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RequestList } from "@/components/requests/request-list";
import { PageHeader } from "@/components/shared/page-header";
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
      <PageHeader
        title={t("views.assignedTitle")}
        description={t("views.assignedDescription")}
      />

      <div className="app-filter-surface flex gap-1 rounded-lg p-1">
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
                  "inline-flex min-w-[1.375rem] items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-[1.375rem]",
                  activeTab === tab
                    ? "bg-white/20 text-white"
                    : tabCounts[tab] > 0
                      ? "bg-red-500 text-white shadow-sm"
                      : "bg-red-50 text-red-400",
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
