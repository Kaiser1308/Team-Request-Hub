"use client";

import { Send, ExternalLink, Unplug, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useTelegramProfile,
  useCreateTelegramLink,
  useUnlinkTelegram,
} from "@/hooks/use-telegram";

export function TelegramSettings() {
  const profileQuery = useTelegramProfile();
  const createLink = useCreateTelegramLink();
  const unlink = useUnlinkTelegram();
  const [showLink, setShowLink] = useState(false);

  const profile = profileQuery.data;

  if (profileQuery.isLoading) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
        <p className="text-sm text-[#6b7280]">Loading Telegram settings...</p>
      </div>
    );
  }

  if (profile?.linked) {
    return (
      <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#0088cc]" aria-hidden="true" />
              <span className="text-sm font-medium text-[#111827]">Telegram</span>
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                Đã liên kết
              </span>
            </div>
            <p className="mt-1 text-xs text-[#6b7280]">
              Nhận thông báo khi bạn được giao task.
              {profile.username ? ` (@${profile.username})` : ""}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unlink.mutate(undefined)}
            disabled={unlink.isPending}
          >
            {unlink.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Hủy liên kết
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-[#6b7280]" aria-hidden="true" />
        <span className="text-sm font-medium text-[#111827]">Telegram</span>
        <span className="text-xs text-[#6b7280]">Chưa liên kết</span>
      </div>
      <p className="mt-1 text-xs text-[#6b7280]">
        Nhận thông báo khi bạn được giao task.
      </p>

      {!showLink ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            createLink.mutate(undefined);
            setShowLink(true);
          }}
          disabled={createLink.isPending}
        >
          {createLink.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Liên kết Telegram
        </Button>
      ) : createLink.data ? (
        <div className="mt-3 space-y-2">
          <a
            href={createLink.data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0088cc] px-3 py-2 text-sm font-medium text-white hover:bg-[#006699] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Mở Telegram
          </a>
          <p className="text-xs text-[#9ca3af]">
            Liên kết có hiệu lực trong 10 phút.
          </p>
        </div>
      ) : createLink.isError ? (
        <p className="mt-2 text-xs text-red-600">
          {createLink.error instanceof Error
            ? createLink.error.message
            : "Could not create link."}
        </p>
      ) : null}
    </div>
  );
}
