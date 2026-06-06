import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";

const NOTIFICATION_PHARMACY_HEAD_SKIP = /^(votre pack|pack non|pack récupéré|réservation|nouvelle|produit|réception|demande|delai|proxi)/i;

const GENERIC_PHARMACY_PLACEHOLDERS = new Set([
  "votre pharmacie",
  "la pharmacie",
  "l'officine",
  "pharmacie",
  "—",
]);

/**
 * Préfixe « Pharmacie » sur le nom d'officine dans les textes notif patient (titre / corps).
 * Ne modifie pas les libellés événementiels ni les placeholders génériques.
 */
export function formatPatientNotificationPharmacyText(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  const trimmed = text.trim();
  if (!trimmed) return trimmed;

  const sep = " — ";
  const idx = trimmed.indexOf(sep);
  if (idx > 0) {
    const head = trimmed.slice(0, idx).trim();
    const tail = trimmed.slice(idx);
    if (
      !GENERIC_PHARMACY_PLACEHOLDERS.has(head.toLowerCase()) &&
      !NOTIFICATION_PHARMACY_HEAD_SKIP.test(head) &&
      !/^pharmacie\b/i.test(head)
    ) {
      return pharmacyPublicLabel(head) + tail;
    }
  }

  return trimmed;
}
