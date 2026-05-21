/** Quantité proposée par l’officine sur une alternative (réponse dossier). */
export const PHARMACIST_ALTERNATIVE_OFFERED_QTY_MIN = 1;
export const PHARMACIST_ALTERNATIVE_OFFERED_QTY_MAX = 10;

export function clampPharmacistAlternativeOfferedQty(n: number): number {
  return Math.min(
    PHARMACIST_ALTERNATIVE_OFFERED_QTY_MAX,
    Math.max(PHARMACIST_ALTERNATIVE_OFFERED_QTY_MIN, Math.floor(Number.isFinite(n) ? n : 1))
  );
}

function isUnavailableBranch(st: string | null | undefined): boolean {
  return st === "market_shortage" || st === "unavailable";
}

/** Plafond patient sur le produit principal (demande / ordonnance). */
export function patientMaxQtyPrincipal(row: {
  requested_qty: number;
  line_source?: string | null;
  availability_status?: string | null;
  available_qty?: number | null;
}): number {
  if (isUnavailableBranch(row.availability_status)) return 0;
  let cap = Math.max(0, Math.floor(Number(row.requested_qty) || 0));
  if (row.line_source === "pharmacist_proposed") {
    cap = Math.max(cap, Number(row.available_qty ?? cap));
  }
  if (row.available_qty != null) {
    const aq = Math.floor(Number(row.available_qty));
    if (Number.isFinite(aq) && aq >= 0) cap = Math.min(cap, aq);
  }
  return Math.max(0, cap);
}

/**
 * Plafond patient sur une alternative : qté proposée par la pharmacie (indépendante du prescrit),
 * sans dépassement possible à la validation.
 */
export function patientMaxQtyAlternative(
  row: Parameters<typeof patientMaxQtyPrincipal>[0],
  alt: { availability_status?: string | null; available_qty?: number | null }
): number {
  if (isUnavailableBranch(alt.availability_status)) return 0;
  if (alt.available_qty != null) {
    const aq = Math.floor(Number(alt.available_qty));
    if (Number.isFinite(aq) && aq >= 0) return aq;
  }
  return patientMaxQtyPrincipal(row);
}
