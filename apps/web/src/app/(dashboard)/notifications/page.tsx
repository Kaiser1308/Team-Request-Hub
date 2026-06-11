import { getTranslations } from "next-intl/server";
import { NotificationList } from "@/components/notifications/notification-list";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PageHeader } from "@/components/shared/page-header";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <NotificationSettings />
      <NotificationList />
    </div>
  );
}
