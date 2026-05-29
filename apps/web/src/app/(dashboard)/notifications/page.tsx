import { getTranslations } from "next-intl/server";
import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4 sm:p-5">
        <h1 className="text-2xl font-semibold text-[#111827]">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-[#6b7280]">
          {t("description")}
        </p>
      </div>
      <NotificationSettings />
      <NotificationList />
    </div>
  );
}
