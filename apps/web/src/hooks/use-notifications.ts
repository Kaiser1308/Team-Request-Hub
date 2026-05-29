"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWebPushSubscription,
  getWebPushPublicKey,
  listNotificationPreferences,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationsReadByType,
  updateNotificationPreferences,
  type BrowserPushSubscriptionPayload,
  type NotificationPreferenceUpdate,
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

const ASSIGNED_TYPES = new Set(["assigned", "reassigned"]);
const POOL_TYPES = new Set(["pool_new"]);

export function useRouteBadgeCounts() {
  return useQuery({
    queryKey: [...queryKeys.notifications, "route-badges"] as const,
    queryFn: async () => {
      const notifications = await listNotifications(true);
      let assigned = 0;
      let pool = 0;
      for (const n of notifications) {
        if (ASSIGNED_TYPES.has(n.type)) assigned++;
        if (POOL_TYPES.has(n.type)) pool++;
      }
      return { assigned, pool };
    },
    staleTime: 20 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useMarkRouteBadgeRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (types: string[]) => markNotificationsReadByType(types),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [...queryKeys.notifications, "route-badges"],
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: queryKeys.notificationPreferences,
    queryFn: listNotificationPreferences,
    staleTime: 60 * 1000,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationPreferenceUpdate) => updateNotificationPreferences(body),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
}

export function useWebPushPublicKey() {
  return useQuery({
    queryKey: queryKeys.webPushPublicKey,
    queryFn: getWebPushPublicKey,
    staleTime: Infinity,
    retry: false,
  });
}

export function useCreateWebPushSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: BrowserPushSubscriptionPayload) => createWebPushSubscription(body),
    onSuccess() {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences });
    },
  });
}
