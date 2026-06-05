export const LOCALES = ["fr", "ar"] as const;
export type AppLocale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "fr";
export const LOCALE_COOKIE = "pp_locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "fr" || value === "ar";
}

/** Chemins toujours en français (pharmacien / admin). */
export function isFrenchOnlyPath(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/pharmacien") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/debug")
  );
}

export function pickLocaleFromAcceptLanguage(header: string | null | undefined): AppLocale {
  if (!header) return DEFAULT_LOCALE;
  const parts = header.split(",").map((p) => p.trim().split(";")[0]?.toLowerCase() ?? "");
  for (const part of parts) {
    if (part.startsWith("ar")) return "ar";
    if (part.startsWith("fr")) return "fr";
  }
  return DEFAULT_LOCALE;
}

export function effectiveLocale(
  cookieLocale: AppLocale,
  pathname: string,
  role?: "patient" | "pharmacien" | "admin" | null,
): AppLocale {
  if (isFrenchOnlyPath(pathname)) return "fr";
  if (role === "pharmacien" || role === "admin") return "fr";
  return cookieLocale;
}

export function localeToBcp47(locale: AppLocale): string {
  return locale === "ar" ? "ar-MA" : "fr-FR";
}

export function localeDirection(locale: AppLocale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}
