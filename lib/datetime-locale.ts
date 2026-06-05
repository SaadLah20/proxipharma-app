import type { AppLocale } from "@/lib/i18n/config";
import { localeToBcp47 } from "@/lib/i18n/config";

export { localeToBcp47 };

export function formatDateForLocale(
  iso: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(localeToBcp47(locale), options);
}

export function formatDateTimeForLocale(
  iso: string | Date,
  locale: AppLocale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(localeToBcp47(locale), options);
}

export function collatorForLocale(locale: AppLocale): Intl.Collator {
  return new Intl.Collator(localeToBcp47(locale));
}
