/**
 * Recherche catalogue produits (patient / pharmacien) : limites et filtre communs.
 */

export const PRODUCT_CATALOG_SEARCH_MIN_CHARS = 2 as const;

/** Assez large pour un scroll ; reste raisonnable côté réseau. */
export const PRODUCT_CATALOG_SEARCH_LIMIT = 48 as const;

/** Page Explorer catalogue patient (scroll infini). */
export const PRODUCT_CATALOG_EXPLORER_PAGE_SIZE = 60 as const;

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

export type ProductCatalogHitWithId = { id: string };

/** Retire les produits déjà présents dans une liste active (panier / lignes dossier). */
export function filterCatalogHitsExcludingProductIds<T extends ProductCatalogHitWithId>(
  hits: readonly T[],
  occupiedProductIds: ReadonlySet<string>
): T[] {
  if (occupiedProductIds.size === 0) return [...hits];
  return hits.filter((h) => !occupiedProductIds.has(h.id));
}

export function productIdsFromLineProductIds(
  lines: readonly { product_id: string }[]
): Set<string> {
  return new Set(lines.map((l) => l.product_id));
}
