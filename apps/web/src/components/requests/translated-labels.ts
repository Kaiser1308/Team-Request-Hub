import type { RequestPriority, RequestStatus, Role } from "@/types";

export type RequestTranslations = (key: string, values?: Record<string, string | number>) => string;

export function translateStatus(t: RequestTranslations, status: RequestStatus | "all" | "new") {
  return t(`status.${status}`);
}

export function translatePriority(t: RequestTranslations, priority: RequestPriority | "all") {
  return t(`priority.${priority}`);
}

export function translateRole(role: Role) {
  return role.toUpperCase();
}
