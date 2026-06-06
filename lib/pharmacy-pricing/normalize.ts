/** Clé normalisée marque (alignée SQL `_normalize_brand_key`). */
export function normalizeBrandKey(brand: string | null | undefined): string {
  return (brand ?? "").trim().toUpperCase();
}

/** @deprecated Utiliser normalizeBrandKey — conservé pour compatibilité imports historiques. */
export function normalizeLaboratoryKey(lab: string | null | undefined): string {
  return normalizeBrandKey(lab);
}
