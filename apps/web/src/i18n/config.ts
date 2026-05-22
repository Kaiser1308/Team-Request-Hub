export const locales = ["vi", "en"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "vi";
export const localeCookieName = "trh-locale";

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return locales.some((locale) => locale === value);
}

export function getValidLocale(value: string | undefined | null): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}
