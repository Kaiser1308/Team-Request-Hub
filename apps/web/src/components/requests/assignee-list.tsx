import { formatUserSummaryLabel } from "@/components/requests/user-display";
import type { UserSummary } from "@/types";

interface AssigneeListProps {
  assignees?: UserSummary[] | null;
  fallback: string;
}

export function AssigneeList({ assignees, fallback }: AssigneeListProps) {
  const visibleAssignees = assignees ?? [];

  if (visibleAssignees.length === 0) {
    return <span className="text-[#6b7280]">{fallback}</span>;
  }

  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {visibleAssignees.map((assignee) => (
        <span
          key={assignee.id}
          className="inline-flex max-w-[180px] items-center rounded-full border border-[#e5e7eb] bg-[#f9fafb] px-2 py-0.5 text-caption text-[#4b5563]"
        >
          <span className="truncate">
            {formatUserSummaryLabel(assignee) ?? assignee.id}
          </span>
        </span>
      ))}
    </span>
  );
}
