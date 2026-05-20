import { apiFetch } from "@/lib/api/client";
import type { Role, User } from "@/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
  role: Role;
}

export interface UserRoleUpdate {
  role: Role;
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/users/me");
}

export function listUsers() {
  return apiFetch<User[]>("/users");
}

export function updateUserRole(userId: string, payload: UserRoleUpdate) {
  return apiFetch<User>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
