/**
 * Recherche catalogue produits (patient / pharmacien) : limites et filtre communs.
 */

export const PRODUCT_CATALOG_SEARCH_MIN_CHARS = 2 as const;

/** Assez large pour un scroll ; reste raisonnable côté réseau. */
export const PRODUCT_CATALOG_SEARCH_LIMIT = 48 as const;

/**
 * Retire les caractères qui modifient le comportement de `ILIKE` ou cassent `.or(...)`.
 */
export function sanitizeProductSearchQuery(raw: string): string {
  return raw.trim().replace(/[%_,]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Filtre PostgREST : nom OU laboratoire (laboratoire souvent null → inchangé si pas de lab).
 */
export function productNameOrLaboratoryIlikeOr(sanitized: string): string {
  const p = `%${sanitized}%`;
  return `name.ilike.${p},laboratory.ilike.${p}`;
}
