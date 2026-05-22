"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTelegramProfile,
  createTelegramLink,
  unlinkTelegram,
} from "@/lib/api/telegram";
import { queryKeys } from "@/lib/api/query-keys";

export function useTelegramProfile() {
  return useQuery({
    queryKey: queryKeys.telegramProfile,
    queryFn: getTelegramProfile,
    staleTime: 60 * 1000,
  });
}

export function useCreateTelegramLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTelegramLink,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: queryKeys.telegramProfile });
    },
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: queryKeys.telegramProfile });
    },
  });
}
