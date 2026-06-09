import type { AppLocale } from "@/lib/i18n/config";

export type PharmacyLocalizedTextFields = {
  nom?: string | null;
  nom_ar?: string | null;
  adresse?: string | null;
  adresse_ar?: string | null;
};

/** Texte officine : AR si locale ar et valeur AR renseignée, sinon FR. */
export function pickPharmacyLocalizedText(
  locale: AppLocale,
  fr: string | null | undefined,
  ar: string | null | undefined,
): string {
  const arTrim = (ar ?? "").trim();
  const frTrim = (fr ?? "").trim();
  if (locale === "ar" && arTrim) return arTrim;
  return frTrim;
}

export function pharmacyLocalizedNom(
  fields: Pick<PharmacyLocalizedTextFields, "nom" | "nom_ar">,
  locale: AppLocale,
): string {
  return pickPharmacyLocalizedText(locale, fields.nom, fields.nom_ar);
}

export function pharmacyLocalizedAdresse(
  fields: Pick<PharmacyLocalizedTextFields, "adresse" | "adresse_ar">,
  locale: AppLocale,
): string {
  return pickPharmacyLocalizedText(locale, fields.adresse, fields.adresse_ar);
}
