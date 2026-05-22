"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe, Check } from "lucide-react";
import { localeCookieName, locales } from "@/i18n/config";
import type { AppLocale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { updateMyLanguage } from "@/lib/api/users";

export function LanguageSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  async function switchLocale(next: AppLocale) {
    document.cookie = `${localeCookieName}=${next};path=/;max-age=31536000;samesite=lax`;
    try {
      await updateMyLanguage(next);
    } catch {
      // Language cookie is the source of truth; backend sync is best-effort.
    }
    router.refresh();
  }

  const localeNames: Record<AppLocale, string> = {
    vi: t("vietnamese"),
    en: t("english"),
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700/80 hover:text-white"
          aria-label={t("language")}
        >
          <Globe className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
          <span className="uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[140px]">
        {locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => switchLocale(loc)}
            className={cn(
              "cursor-pointer gap-2",
              locale === loc && "font-medium",
            )}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {locale === loc && <Check className="h-3.5 w-3.5" />}
            </span>
            {localeNames[loc]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
