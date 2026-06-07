/**
 * Accent emerald discret — parcours patient « réservation pack promo ».
 */

import { promoPublicTheme } from "@/lib/promo/promo-public-theme";

/** Contour page / section dossier réservation (tous statuts patient). */
export const patientPromoReservationDossierSectionShellClass =
  "border-emerald-200/60 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/15 ring-1 ring-emerald-200/40";

/** Carte contenu pack dans le dossier. */
export const patientPromoReservationLineCardClass =
  "w-full min-w-0 rounded-lg border border-emerald-200/60 bg-card px-2 py-2.5 shadow-sm ring-1 ring-emerald-100/35";

export function patientPromoReservationDossierHeaderShellClass(): string {
  return "rounded-xl border border-emerald-200/60 bg-card shadow-sm ring-1 ring-emerald-100/40";
}

export { promoPublicTheme as patientPromoReservationPublicTheme };
