import type { AppLocale } from "@/lib/i18n/config";
import { pickPharmacyLocalizedText } from "@/lib/pharmacy-localized-field";

/** Libellé public : préfixe « Pharmacie » / « صيدلية » si le nom stocké ne l'inclut pas déjà. */
export function pharmacyPublicLabel(
  nom: string | null | undefined,
  options?: { locale?: AppLocale; nomAr?: string | null },
): string {
  const locale = options?.locale ?? "fr";
  const raw = pickPharmacyLocalizedText(locale, nom, options?.nomAr);
  if (!raw) return locale === "ar" ? "هذه الصيدلية" : "Cette pharmacie";
  if (locale === "ar") {
    if (/^صيدلية\b/u.test(raw)) return raw;
    return `صيدلية ${raw}`;
  }
  if (/^pharmacie\b/i.test(raw)) return raw;
  return `Pharmacie ${raw}`;
}
