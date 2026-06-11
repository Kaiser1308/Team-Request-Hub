"use client";

import { useTranslations } from "next-intl";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { PageHeader } from "@/components/shared/page-header";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <NotificationSettings />
    </div>
  );
}
