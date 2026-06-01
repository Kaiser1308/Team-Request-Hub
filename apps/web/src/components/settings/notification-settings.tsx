"use client";

import { Button } from "@/components/ui/button";
import {
  useCreateWebPushSubscription,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useWebPushPublicKey,
} from "@/hooks/use-notifications";
import { subscribeToWebPush } from "@/lib/web-push";

function isEnabled(preferences: { channel: string; enabled: boolean }[] | undefined, channel: string) {
  return preferences?.find((item) => item.channel === channel)?.enabled ?? true;
}

export function NotificationSettings() {
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const publicKey = useWebPushPublicKey();
  const createSubscription = useCreateWebPushSubscription();
  const rows = preferences.data;
  const webPushEnabled = isEnabled(rows, "web_push");

  async function enableWebPush() {
    if (!publicKey.data?.public_key) return;
    const subscription = await subscribeToWebPush(publicKey.data.public_key);
    await createSubscription.mutateAsync(subscription);
    updatePreferences.mutate({ web_push: true });
  }

  function disableWebPush() {
    updatePreferences.mutate({ web_push: false });
  }

  return (
    <section className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-semibold text-[#111827]">Notification channels</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          Choose where you want to receive assigned and reassigned request alerts.
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center justify-between rounded-md border border-[#e5e7eb] p-3">
          <span className="text-sm font-medium text-[#111827]">Email</span>
          <input
            type="checkbox"
            checked={isEnabled(rows, "email")}
            disabled={preferences.isLoading || updatePreferences.isPending}
            onChange={(event) => updatePreferences.mutate({ email: event.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between rounded-md border border-[#e5e7eb] p-3">
          <span className="text-sm font-medium text-[#111827]">Telegram</span>
          <input
            type="checkbox"
            checked={isEnabled(rows, "telegram")}
            disabled={preferences.isLoading || updatePreferences.isPending}
            onChange={(event) => updatePreferences.mutate({ telegram: event.target.checked })}
          />
        </label>

        <div className="rounded-md border border-[#e5e7eb] p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Browser Push</p>
              <p className="text-xs text-[#6b7280]">Requires browser permission on this device.</p>
            </div>
            {webPushEnabled ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={updatePreferences.isPending}
                onClick={disableWebPush}
              >
                Disable browser notifications
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={publicKey.isLoading || createSubscription.isPending || updatePreferences.isPending}
                onClick={() => void enableWebPush()}
              >
                Enable browser notifications
              </Button>
            )}
          </div>
          {createSubscription.isError ? (
            <p className="mt-2 text-xs text-red-600">
              {createSubscription.error instanceof Error
                ? createSubscription.error.message
                : "Could not enable browser notifications."}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
