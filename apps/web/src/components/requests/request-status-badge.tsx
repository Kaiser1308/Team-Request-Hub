"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { translateStatus } from "@/components/requests/translated-labels";
import type { RequestStatus } from "@/types";

const statusClassName: Record<RequestStatus, string> = {
  pending: "border-[#d1d5db] bg-[#f3f4f6] text-[#374151]",
  acknowledged: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-blue-300 bg-blue-100 text-blue-800 font-semibold",
  done: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-red-200 bg-red-50 text-red-600",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("requests");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium",
        statusClassName[status],
      )}
    >
      {translateStatus(t, status)}
    </span>
  );
}
