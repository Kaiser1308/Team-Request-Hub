"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { translateStatus } from "@/components/requests/translated-labels";
import type { RequestStatus } from "@/types";

const statusClassName: Record<RequestStatus, string> = {
  pending: "border-[#d8d2cc] bg-[#f7f5f2] text-[#615d59]",
  acknowledged: "border-[#b8d8f2] bg-[#f2f9ff] text-[#097fe8]",
  in_progress: "border-[#9bc8f0] bg-[#e8f4ff] text-[#005bab]",
  done: "border-[#bfe8cf] bg-[#effaf3] text-[#12833a]",
  cancelled: "border-[#f1c4c4] bg-[#fff3f3] text-[#b42318]",
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const t = useTranslations("requests");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full border px-1.5 py-0 text-[11px] font-semibold leading-5 tracking-[0.01em] shadow-[rgba(0,0,0,0.015)_0px_1px_1px]",
        statusClassName[status],
      )}
    >
      <span className="truncate">{translateStatus(t, status)}</span>
    </span>
  );
}
