import { cn } from "@/lib/utils";
import type { RequestPriority } from "@/types";

const priorityLabel: Record<RequestPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const priorityClassName: Record<RequestPriority, string> = {
  low: "border-[#e5e7eb] bg-[#f9fafb] text-[#6b7280]",
  medium: "border-[#d1d5db] bg-white text-[#374151]",
  high: "border-amber-200 bg-amber-50 text-amber-700",
  urgent: "border-red-200 bg-red-50 text-red-700",
};

export function RequestPriorityBadge({
  priority,
}: {
  priority: RequestPriority;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        priorityClassName[priority],
      )}
    >
      {priorityLabel[priority]}
    </span>
  );
}
