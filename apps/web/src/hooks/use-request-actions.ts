"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    selfAssign: useMutation({
      mutationFn: (requestId: string) => selfAssignRequest(requestId),
      onSuccess: (_, requestId) => invalidateRequestData(requestId),
    }),
    reassign: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: ReassignRequestPayload;
      }) => reassignRequest(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    updateStatus: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: StatusUpdatePayload;
      }) => updateRequestStatus(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    markDone: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: DoneRequestPayload;
      }) => markRequestDone(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
    cancel: useMutation({
      mutationFn: ({
        requestId,
        payload,
      }: {
        requestId: string;
        payload: CancelRequestPayload;
      }) => cancelRequest(requestId, payload),
      onSuccess: (_, variables) => invalidateRequestData(variables.requestId),
    }),
  };
}
