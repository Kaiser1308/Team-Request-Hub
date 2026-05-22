"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listActiveUsers,
  listUsers,
  updateUserActiveState,
  updateUserRole,
} from "@/lib/api/users";
import { queryKeys } from "@/lib/api/query-keys";
import type { Role } from "@/types";

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: listUsers,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useActiveUsers() {
  return useQuery({
    queryKey: queryKeys.assignableUsers,
    queryFn: listActiveUsers,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      updateUserRole(userId, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.currentUser });
    },
  });
}

export function useUpdateUserActiveState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      updateUserActiveState(userId, { is_active: isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      void queryClient.invalidateQueries({ queryKey: queryKeys.assignableUsers });
    },
  });
}
