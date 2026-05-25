"use client";

import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  cancelRequest,
  createRequest,
  markRequestDone,
  reassignRequest,
  selfAssignRequest,
  updateRequest,
  updateRequestStatus,
  type CancelRequestPayload,
  type DoneRequestPayload,
  type InternalRequestCreatePayload,
  type InternalRequestUpdatePayload,
  type ReassignRequestPayload,
  type StatusUpdatePayload,
} from "@/lib/api/requests";
import { queryKeys } from "@/lib/api/query-keys";
import type { InternalRequest } from "@/types";

const requestListViews = new Set(["assigned", "created", "pool", "done", "all"]);

function updateCachedRequest(
  queryClient: QueryClient,
  updatedRequest: InternalRequest,
) {
  queryClient.setQueryData(
    queryKeys.requests.detail(updatedRequest.id),
    updatedRequest,
  );

  queryClient.setQueriesData<InternalRequest[]>(
    {
      predicate: ({ queryKey }) =>
        queryKey[0] === "requests" &&
        typeof queryKey[1] === "string" &&
        requestListViews.has(queryKey[1]),
    },
    (requests) =>
      requests?.map((request) =>
        request.id === updatedRequest.id ? updatedRequest : request,
      ),
  );
}

export function useRequestActions() {
  const queryClient = useQueryClient();

  function invalidateRequestData(requestId?: string) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.requests.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

    if (requestId) {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.detail(requestId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.assignmentHistory(requestId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.requests.statusLogs(requestId),
      });
    }
  }

  return {
    create: useMutation({
      mutationFn: (payload: InternalRequestCreatePayload) =>
        createRequest(payload),
      onSuccess: () => invalidateRequestData(),
    }),
    update: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: InternalRequestUpdatePayload;
      }) => updateRequest(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
    selfAssign: useMutation({
      mutationFn: (requestId: string) => selfAssignRequest(requestId),
      onSuccess: (updatedRequest, requestId) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(requestId);
      },
    }),
    reassign: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: ReassignRequestPayload;
      }) => reassignRequest(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
    updateStatus: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: StatusUpdatePayload;
      }) => updateRequestStatus(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
    markDone: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: DoneRequestPayload;
      }) => markRequestDone(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
    cancel: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: CancelRequestPayload;
      }) => cancelRequest(requestId, payload),
      onSuccess: (updatedRequest, variables) => {
        updateCachedRequest(queryClient, updatedRequest);
        invalidateRequestData(variables.requestId);
      },
    }),
  };
}
