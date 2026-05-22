import { apiFetch } from "@/lib/api/client";
import type {
  AssignmentHistory,
  InternalRequest,
  RequestPriority,
  RequestStatus,
  RequestStatusLog,
} from "@/types";

export type RequestView = "assigned" | "created" | "pool" | "done" | "all";

export interface ListRequestsParams {
  view: RequestView;
  limit?: number;
}

export interface InternalRequestCreatePayload {
  title: string;
  description: string;
  tags: string[];
  priority: RequestPriority;
  assigned_to?: string | null;
  reference_links: string[];
}

export interface InternalRequestUpdatePayload {
  title?: string;
  description?: string;
  tags?: string[];
  priority?: RequestPriority;
  reference_links?: string[];
}

export interface ReassignRequestPayload {
  assigned_to: string;
  reason?: string | null;
}

export interface StatusUpdatePayload {
  status: Exclude<RequestStatus, "done" | "cancelled">;
  reason?: string | null;
}

export interface DoneRequestPayload {
  reply: string;
}

export interface CancelRequestPayload {
  reason?: string | null;
}

export function listRequests({ view, limit = 50 }: ListRequestsParams) {
  const searchParams = new URLSearchParams({
    view,
    limit: String(limit),
  });
  return apiFetch<InternalRequest[]>(`/requests?${searchParams.toString()}`);
}

export function getRequest(requestId: string) {
  return apiFetch<InternalRequest>(`/requests/${requestId}`);
}

export function createRequest(payload: InternalRequestCreatePayload) {
  return apiFetch<InternalRequest>("/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequest(
  requestId: string,
  payload: InternalRequestUpdatePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function selfAssignRequest(requestId: string) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/self-assign`, {
    method: "POST",
  });
}

export function reassignRequest(
  requestId: string,
  payload: ReassignRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/reassign`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateRequestStatus(
  requestId: string,
  payload: StatusUpdatePayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/status`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markRequestDone(
  requestId: string,
  payload: DoneRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/done`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function cancelRequest(
  requestId: string,
  payload: CancelRequestPayload,
) {
  return apiFetch<InternalRequest>(`/requests/${requestId}/cancel`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAssignmentHistory(requestId: string) {
  return apiFetch<AssignmentHistory[]>(
    `/requests/${requestId}/assignment-history`,
  );
}

export function getStatusLogs(requestId: string) {
  return apiFetch<RequestStatusLog[]>(`/requests/${requestId}/status-logs`);
}
