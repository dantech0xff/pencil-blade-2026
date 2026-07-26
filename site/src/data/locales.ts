export const LOCALES = ["en", "vi"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "vi" : "en";
}
