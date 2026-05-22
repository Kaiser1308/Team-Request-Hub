"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notifications";
import { queryKeys } from "@/lib/api/query-keys";

export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: unreadOnly
      ? [...queryKeys.notifications, "unread"] as const
      : queryKeys.notifications,
    queryFn: () => listNotifications(unreadOnly),
    staleTime: unreadOnly ? 20 * 1000 : 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();

  function invalidateNotifications() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
  }

  return {
    markRead: useMutation({
      mutationFn: markNotificationRead,
      onSuccess: invalidateNotifications,
    }),
    markAllRead: useMutation({
      mutationFn: markAllNotificationsRead,
      onSuccess: invalidateNotifications,
    }),
  };
}
