"use client";

import { Button } from "@/components/ui/button";
import {
  useCreateWebPushSubscription,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useWebPushPublicKey,
} from "@/hooks/use-notifications";
import { subscribeToWebPush } from "@/lib/web-push";
import { useTranslations } from "next-intl";

function isEnabled(preferences: { channel: string; enabled: boolean }[] | undefined, channel: string) {
  return preferences?.find((item) => item.channel === channel)?.enabled ?? true;
}

export function NotificationSettings() {
  const t = useTranslations("settings");
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
        <h2 className="text-lg font-semibold text-[#111827]">{t("notificationChannels")}</h2>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("notificationChannelsDescription")}
        </p>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="flex items-center justify-between gap-3 rounded-md border border-[#e5e7eb] bg-[#f9fafb] p-3">
          <span className="grid gap-0.5">
            <span className="text-sm font-medium text-[#111827]">{t("email")}</span>
            <span id="email-notification-development" className="text-xs text-[#dc2626]">{t("emailInDevelopment")}</span>
          </span>
          <input
            type="checkbox"
            checked={isEnabled(rows, "email")}
            disabled
            aria-describedby="email-notification-development"
          />
        </label>

        <label className="flex items-center justify-between rounded-md border border-[#e5e7eb] p-3">
          <span className="text-sm font-medium text-[#111827]">{t("telegram")}</span>
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
              <p className="text-sm font-medium text-[#111827]">{t("browserPush")}</p>
              <p className="text-xs text-[#6b7280]">{t("browserPushDescription")}</p>
            </div>
            {webPushEnabled ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={updatePreferences.isPending}
                onClick={disableWebPush}
              >
                {t("disableBrowserNotifications")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={publicKey.isLoading || createSubscription.isPending || updatePreferences.isPending}
                onClick={() => void enableWebPush()}
              >
                {t("enableBrowserNotifications")}
              </Button>
            )}
          </div>
          {createSubscription.isError ? (
            <p className="mt-2 text-xs text-red-600">
              {createSubscription.error instanceof Error
                ? createSubscription.error.message
                : t("browserNotificationsError")}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
