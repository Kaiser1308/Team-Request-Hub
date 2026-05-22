import { apiFetch } from "@/lib/api/client";
import type { Role, User } from "@/types";

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  avatar_url?: string | null;
  role: Role;
  is_active: boolean;
}

export interface UserRoleUpdate {
  role: Role;
}

export interface UserActiveUpdate {
  is_active: boolean;
}

export function getCurrentUser() {
  return apiFetch<CurrentUser>("/users/me");
}

export function listUsers() {
  return apiFetch<User[]>("/users");
}

export function listActiveUsers() {
  return apiFetch<User[]>("/users/active");
}

export function updateUserRole(userId: string, payload: UserRoleUpdate) {
  return apiFetch<User>(`/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateUserActiveState(userId: string, payload: UserActiveUpdate) {
  return apiFetch<User>(`/users/${userId}/active`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateMyLanguage(language: string) {
  return apiFetch(`/users/me/language`, {
    method: "PATCH",
    body: JSON.stringify({ language }),
  });
}
