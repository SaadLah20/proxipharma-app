/** Statuts dossier où les prix catalogue restent masqués si l'officine a désactivé l'affichage pré-réponse. */
const HIDE_PRICE_REQUEST_STATUSES = new Set(["submitted", "in_review"]);

/**
 * Détermine si le patient doit voir les PU catalogue résolus.
 * @param showFlag Valeur officine `show_catalog_prices_before_response` (défaut true).
 * @param requestStatus Statut dossier ; absent = parcours saisie (catalogue/panier).
 */
export function shouldShowCatalogPricesToPatient(
  showFlag: boolean | null | undefined,
  requestStatus?: string | null
): boolean {
  if (showFlag !== false) return true;
  if (!requestStatus) return false;
  return !HIDE_PRICE_REQUEST_STATUSES.has(requestStatus);
}

export function defaultShowCatalogPricesBeforeResponse(
  settings: { show_catalog_prices_before_response?: boolean } | null | undefined
): boolean {
  return settings?.show_catalog_prices_before_response !== false;
}
