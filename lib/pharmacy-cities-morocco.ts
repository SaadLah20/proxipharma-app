import type { AppLocale } from "@/lib/i18n/config";
import { collatorForLocale } from "@/lib/datetime-locale";

export type PharmacyCityEntry = {
  /** Valeur canonique stockée en base (`pharmacies.ville`). */
  fr: string;
  ar: string;
};

/** Villes / communes pilote Pharmeto — valeur FR = clé canonique en base. */
export const PHARMACY_CITIES_MOROCCO: readonly PharmacyCityEntry[] = [
  { fr: "Agadir", ar: "أكادير" },
  { fr: "Al Hoceïma", ar: "الحسيمة" },
  { fr: "Beni Mellal", ar: "بني ملال" },
  { fr: "Berkane", ar: "بركان" },
  { fr: "Berrechid", ar: "برشيد" },
  { fr: "Casablanca", ar: "الدار البيضاء" },
  { fr: "Dakhla", ar: "الداخلة" },
  { fr: "El Jadida", ar: "الجديدة" },
  { fr: "Errachidia", ar: "الرشيدية" },
  { fr: "Essaouira", ar: "الصويرة" },
  { fr: "Fès", ar: "فاس" },
  { fr: "Guelmim", ar: "كلميم" },
  { fr: "Khémisset", ar: "الخميسات" },
  { fr: "Khouribga", ar: "خريبكة" },
  { fr: "Kénitra", ar: "القنيطرة" },
  { fr: "Laâyoune", ar: "العيون" },
  { fr: "Larache", ar: "العرائش" },
  { fr: "Marrakech", ar: "مراكش" },
  { fr: "Martil", ar: "مرتيل" },
  { fr: "Meknès", ar: "مكناس" },
  { fr: "Mohammédia", ar: "المحمدية" },
  { fr: "Nador", ar: "الناظور" },
  { fr: "Ouarzazate", ar: "ورزازات" },
  { fr: "Oujda", ar: "وجدة" },
  { fr: "Rabat", ar: "الرباط" },
  { fr: "Safi", ar: "آسفي" },
  { fr: "Salé", ar: "سلا" },
  { fr: "Settat", ar: "سطات" },
  { fr: "Skhirate", ar: "الصخيرات" },
  { fr: "Tanger", ar: "طنجة" },
  { fr: "Taza", ar: "تازة" },
  { fr: "Témara", ar: "تمارة" },
  { fr: "Tétouan", ar: "تطوان" },
  { fr: "Tifelt", ar: "تيفلت" },
] as const;

function normalizeCityKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

const cityByFrKey = new Map<string, PharmacyCityEntry>(
  PHARMACY_CITIES_MOROCCO.map((entry) => [normalizeCityKey(entry.fr), entry]),
);

/** Résout une valeur stockée (ou saisie) vers l'entrée catalogue. */
export function lookupPharmacyCity(ville: string | null | undefined): PharmacyCityEntry | null {
  const trimmed = (ville ?? "").trim();
  if (!trimmed) return null;
  return cityByFrKey.get(normalizeCityKey(trimmed)) ?? null;
}

/** Libellé affiché : AR si locale ar et ville connue, sinon FR canonique ou valeur brute. */
export function pharmacyCityLabel(ville: string | null | undefined, locale: AppLocale): string {
  const trimmed = (ville ?? "").trim();
  if (!trimmed) return "";
  const entry = lookupPharmacyCity(trimmed);
  if (locale === "ar" && entry) return entry.ar;
  return entry?.fr ?? trimmed;
}

/** Termes de recherche annuaire / hubs (FR + AR si connue). */
export function pharmacyCitySearchTerms(ville: string | null | undefined): string[] {
  const trimmed = (ville ?? "").trim();
  if (!trimmed) return [];
  const entry = lookupPharmacyCity(trimmed);
  if (!entry) return [trimmed];
  return entry.fr === trimmed || normalizeCityKey(entry.fr) === normalizeCityKey(trimmed)
    ? [entry.fr, entry.ar]
    : [trimmed, entry.fr, entry.ar];
}

export function validatePharmacyCityForSubmit(
  ville: string,
  options?: { allowLegacy?: boolean },
): string | null {
  const trimmed = ville.trim();
  if (!trimmed) return "Indiquez la ville.";
  if (lookupPharmacyCity(trimmed)) return null;
  if (options?.allowLegacy) return null;
  return "Choisissez une ville dans la liste.";
}

export type PharmacyCitySelectOption = {
  value: string;
  label: string;
  legacy?: boolean;
};

/** Options triées pour les listes admin / ma fiche (interface FR). */
export function buildPharmacyCitySelectOptions(legacyValue?: string | null): PharmacyCitySelectOption[] {
  const collator = collatorForLocale("fr");
  const options: PharmacyCitySelectOption[] = [...PHARMACY_CITIES_MOROCCO]
    .sort((a, b) => collator.compare(a.fr, b.fr))
    .map((entry) => ({ value: entry.fr, label: entry.fr }));

  const legacy = (legacyValue ?? "").trim();
  if (legacy && !lookupPharmacyCity(legacy)) {
    return [{ value: legacy, label: `${legacy} (hors liste)`, legacy: true }, ...options];
  }
  return options;
}
