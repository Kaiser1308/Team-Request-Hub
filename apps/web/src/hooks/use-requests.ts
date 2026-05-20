"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAssignmentHistory,
  getRequest,
  getStatusLogs,
  listRequests,
  type RequestView,
} from "@/lib/api/requests";
import { queryKeys } from "@/lib/api/query-keys";

export function useRequests(view: RequestView) {
  return useQuery({
    queryKey: queryKeys.requests.list(view),
    queryFn: () => listRequests(view),
  });
}

export function useRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: requestId.length > 0,
  });
}

export function useRequestAssignmentHistory(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.assignmentHistory(requestId),
    queryFn: () => getAssignmentHistory(requestId),
    enabled: requestId.length > 0,
  });
}

export function useRequestStatusLogs(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.statusLogs(requestId),
    queryFn: () => getStatusLogs(requestId),
    enabled: requestId.length > 0,
  });
}
