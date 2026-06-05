import { formatUserSummaryLabel } from "@/components/requests/user-display";
import type { UserSummary } from "@/types";

interface AssigneeListProps {
  assignees?: UserSummary[] | null;
  fallback: string;
  variant?: "default" | "compact";
}

export function AssigneeList({
  assignees,
  fallback,
  variant = "default",
}: AssigneeListProps) {
  const visibleAssignees = assignees ?? [];
  const compact = variant === "compact";

  if (visibleAssignees.length === 0) {
    return <span className="text-[#8b8580]">{fallback}</span>;
  }

  return (
    <span className="inline-flex max-w-full flex-wrap gap-1 align-middle">
      {visibleAssignees.map((assignee) => (
        <span
          key={assignee.id}
          className={
            compact
              ? "inline-flex max-w-full items-center rounded-full border border-[#e3ded8] bg-white px-2 py-0.5 text-[11px] leading-4 text-[#615d59] shadow-[rgba(0,0,0,0.015)_0px_1px_1px]"
              : "inline-flex max-w-full items-center rounded-full border border-[#e3ded8] bg-[#fbfaf9] px-2 py-0.5 text-caption text-[#615d59] sm:max-w-[180px]"
          }
        >
          <span className="truncate">
            {compact
              ? assignee.name ?? assignee.email ?? assignee.id
              : formatUserSummaryLabel(assignee) ?? assignee.id}
          </span>
        </span>
      ))}
    </span>
  );
}
