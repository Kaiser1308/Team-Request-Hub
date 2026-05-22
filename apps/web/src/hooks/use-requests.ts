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

export function useRequests(view: RequestView, limit = 50) {
  return useQuery({
    queryKey: queryKeys.requests.list(view, limit),
    queryFn: () => listRequests({ view, limit }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });
}

export function useRequest(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.detail(requestId),
    queryFn: () => getRequest(requestId),
    enabled: requestId.length > 0,
    staleTime: 15 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRequestAssignmentHistory(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.assignmentHistory(requestId),
    queryFn: () => getAssignmentHistory(requestId),
    enabled: requestId.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useRequestStatusLogs(requestId: string) {
  return useQuery({
    queryKey: queryKeys.requests.statusLogs(requestId),
    queryFn: () => getStatusLogs(requestId),
    enabled: requestId.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
