"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { RequestList } from "@/components/requests/request-list";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useRequests } from "@/hooks/use-requests";
import { cn } from "@/lib/utils";

type CreatedTab = "pending" | "acknowledged" | "in_progress";

const tabs: CreatedTab[] = ["pending", "acknowledged", "in_progress"];

export default function RequestsPage() {
  const t = useTranslations("requests");
  const [activeTab, setActiveTab] = useState<CreatedTab>("pending");
  const createdQuery = useRequests("created");
  const tabCounts = useMemo(() => {
    return tabs.reduce<Record<CreatedTab, number>>(
      (counts, tab) => {
        counts[tab] =
          createdQuery.data?.filter((request) => request.status === tab).length ?? 0;
        return counts;
      },
      { pending: 0, acknowledged: 0, in_progress: 0 },
    );
  }, [createdQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("views.createdTitle")}
        description={t("views.createdDescription")}
        action={
          <Button asChild>
            <Link href="/requests/new">{t("list.createRequest")}</Link>
          </Button>
        }
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

      <CreatedTabContent
        key={activeTab}
        status={activeTab}
        emptyMessage={t(`empty.created_${activeTab}`)}
      />
    </div>
  );
}

function CreatedTabContent({
  status,
  emptyMessage,
}: {
  status: CreatedTab;
  emptyMessage: string;
}) {
  return (
    <RequestList
      view="created"
      emptyMessage={emptyMessage}
      defaultStatus={status}
    />
  );
}
