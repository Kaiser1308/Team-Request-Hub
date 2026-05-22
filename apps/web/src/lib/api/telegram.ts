import { apiFetch } from "@/lib/api/client";

export type TelegramProfile = {
  linked: boolean;
  username?: string | null;
  linked_at?: string | null;
};

export type TelegramLink = {
  url: string;
  expires_at: string;
};

export function getTelegramProfile() {
  return apiFetch<TelegramProfile>("/notifications/telegram/profile");
}

export function createTelegramLink() {
  return apiFetch<TelegramLink>("/notifications/telegram/link", {
    method: "POST",
  });
}

export function unlinkTelegram() {
  return apiFetch<TelegramProfile>("/notifications/telegram/link", {
    method: "DELETE",
  });
}
