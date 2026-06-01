import { apiFetch } from "@/lib/api/client";
import type { InternalRequest } from "@/types";

export interface DashboardCounts {
  assigned: number;
  created: number;
  pending: number;
  done: number;
  urgent: number;
}

export interface DashboardSummary {
  counts: DashboardCounts;
  assigned_recent: InternalRequest[];
  created_recent: InternalRequest[];
  pending_recent: InternalRequest[];
  notifications_unread: number;
}

export function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/dashboard/summary");
}
