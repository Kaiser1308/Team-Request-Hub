import type { User, UserSummary } from "@/types";

export function formatUserLabel(user: Pick<User, "email" | "name">) {
  return user.name ? `${user.name} (${user.email})` : user.email;
}

export function formatUserSummaryLabel(user?: UserSummary | null) {
  if (!user) {
    return null;
  }
  if (user.name && user.email) {
    return `${user.name} (${user.email})`;
  }
  return user.name ?? user.email ?? user.id;
}

export function findUserLabel(users: User[] | undefined, userId?: string | null) {
  if (!userId) {
    return "Unassigned";
  }

  const user = users?.find((item) => item.id === userId);
  return user ? formatUserLabel(user) : userId;
}
