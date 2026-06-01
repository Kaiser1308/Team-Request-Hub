"use client";

import { useTranslations } from "next-intl";
import { NotificationSettings } from "@/components/settings/notification-settings";

export default function SettingsPage() {
  const t = useTranslations("settings");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-page-title text-[#111827]">{t("title")}</h1>
        <p className="mt-1 text-sm text-[#6b7280]">{t("description")}</p>
      </div>
      <NotificationSettings />
    </div>
  );
}
