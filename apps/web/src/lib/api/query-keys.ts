import type { RequestView } from "@/lib/api/requests";

export const queryKeys = {
  currentUser: ["current-user"] as const,
  users: ["users"] as const,
  requests: {
    all: ["requests"] as const,
    list: (view: RequestView) => ["requests", view] as const,
    detail: (requestId: string) => ["requests", "detail", requestId] as const,
    assignmentHistory: (requestId: string) =>
      ["requests", "assignment-history", requestId] as const,
    statusLogs: (requestId: string) =>
      ["requests", "status-logs", requestId] as const,
  },
  notifications: ["notifications"] as const,
};
