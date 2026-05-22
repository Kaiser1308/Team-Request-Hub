"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { localeCookieName, locales } from "@/i18n/config";
import type { AppLocale } from "@/i18n/config";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as AppLocale;
    document.cookie = `${localeCookieName}=${next};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  const localeNames: Record<AppLocale, string> = {
    vi: t("vietnamese"),
    en: t("english"),
  };

  return (
    <select
      value={locale}
      onChange={handleChange}
      aria-label={t("language")}
      className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1 text-xs text-[#4b5563]"
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeNames[loc]}
        </option>
      ))}
    </select>
  );
}
