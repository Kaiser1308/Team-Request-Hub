import type { RequestView } from "@/lib/api/requests";

export const queryKeys = {
  currentUser: ["current-user"] as const,
  users: ["users"] as const,
  assignableUsers: ["users", "active"] as const,
  requests: {
    all: ["requests"] as const,
    list: (view: RequestView, limit: number) => ["requests", view, { limit }] as const,
    detail: (requestId: string) => ["requests", "detail", requestId] as const,
    assignmentHistory: (requestId: string) =>
      ["requests", "assignment-history", requestId] as const,
    statusLogs: (requestId: string) =>
      ["requests", "status-logs", requestId] as const,
  },
  notifications: ["notifications"] as const,
  dashboardSummary: ["dashboard", "summary"] as const,
  telegramProfile: ["telegram", "profile"] as const,
  notificationPreferences: ["notifications", "preferences"] as const,
  webPushPublicKey: ["notifications", "web-push", "public-key"] as const,
  files: {
    all: ["files"] as const,
    list: (path: string, includeDeleted: boolean) =>
      ["files", "list", { path, includeDeleted }] as const,
    search: (query: string, includeDeleted: boolean) =>
      ["files", "search", { query, includeDeleted }] as const,
    activity: (fileId?: string) =>
      ["files", "activity", fileId ?? "all"] as const,
  },
};
