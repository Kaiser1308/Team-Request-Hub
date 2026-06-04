"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { translatePriority } from "@/components/requests/translated-labels";
import type { RequestPriority } from "@/types";

const priorityClassName: Record<RequestPriority, string> = {
  low: "border-[#ddd7d1] bg-[#fbfaf9] text-[#7a746f]",
  medium: "border-[#d8d2cc] bg-white text-[#4f4a45]",
  high: "border-[#f1d3a3] bg-[#fff8ea] text-[#b45309]",
  urgent: "border-[#f3b8b8] bg-[#fff1f1] text-[#c1121f]",
};

export function RequestPriorityBadge({
  priority,
}: {
  priority: RequestPriority;
}) {
  const t = useTranslations("requests");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-1.5 py-0 text-[11px] font-semibold leading-5 tracking-[0.01em] shadow-[rgba(0,0,0,0.015)_0px_1px_1px]",
        priorityClassName[priority],
      )}
    >
      <span className="truncate">{translatePriority(t, priority)}</span>
    </span>
  );
}
