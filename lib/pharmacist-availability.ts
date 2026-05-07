/** Valeurs `availability_status_enum` (Postgres) + libellés UI */

/**
 * Options accessibles côté UI au pharmacien sur une ligne demandée par le patient.
 * « Partiellement disponible » est exclu : c'est le serveur (ou la couche app)
 * qui dérive ce statut quand la quantité saisie < quantité demandée.
 */
export const PHARMACIST_AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "unavailable", label: "Indisponible" },
  { value: "to_order", label: "À commander" },
  { value: "market_shortage", label: "Rupture du marché" },
];

/**
 * Pour les lignes proposées par la pharmacie (line_source = 'pharmacist_proposed'),
 * seules deux dispos ont du sens : disponible ou à commander.
 */
export const PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS: { value: string; label: string }[] = [
  { value: "available", label: "Disponible" },
  { value: "to_order", label: "À commander" },
];

/**
 * Dérive automatiquement « partially_available » lorsque le pharmacien renseigne
 * un statut « available » avec une quantité < quantité demandée.
 * - available_qty <= 0 : conserve « unavailable » par défaut.
 * - available_qty < requested_qty : passe en « partially_available ».
 * - available_qty >= requested_qty : reste « available ».
 */
export function inferAvailabilityStatusFromQty(args: {
  status: string;
  availableQty: number;
  requestedQty: number;
  isProposedLine?: boolean;
}): string {
  const { status, availableQty, requestedQty, isProposedLine } = args;
  if (status !== "available") return status;
  if (!Number.isFinite(availableQty) || !Number.isFinite(requestedQty)) return status;
  if (availableQty <= 0) {
    return isProposedLine ? "available" : "unavailable";
  }
  if (availableQty < requestedQty) {
    /** Produit proposé par la pharmacie : pas de « partiellement disponible » automatique. */
    if (isProposedLine) return "available";
    return "partially_available";
  }
  return "available";
}
