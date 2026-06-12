import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import type { CatalogProductSource, UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";

function mapRpcHit(row: Record<string, unknown>): UnifiedCatalogHit {
  return {
    source: row.source as CatalogProductSource,
    id: String(row.id),
    name: String(row.name ?? ""),
    product_type: String(row.product_type ?? "parapharmacie"),
    brand: (row.brand as string | null) ?? null,
    laboratory: (row.laboratory as string | null) ?? null,
    photo_url: (row.photo_url as string | null) ?? null,
    price_pph: row.price_pph != null ? Number(row.price_pph) : null,
    price_ppv: row.price_ppv != null ? Number(row.price_ppv) : null,
    full_description: (row.full_description as string | null) ?? null,
  };
}

/** Recherche unifiée catalogue global + privé officine. */
export async function searchPharmacyCatalog(
  supabase: SupabaseClient,
  pharmacyId: string,
  query: string,
  limit = PRODUCT_CATALOG_SEARCH_LIMIT
): Promise<UnifiedCatalogHit[]> {
  const sanitized = sanitizeProductSearchQuery(query);
  if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS || !pharmacyId) {
    return [];
  }

  const { data, error } = await supabase.rpc("pharmacy_catalog_search", {
    p_pharmacy_id: pharmacyId,
    p_query: sanitized,
    p_limit: limit,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRpcHit(row as Record<string, unknown>));
}

/** Retire les hits déjà occupés sur le dossier (clé source:id). */
export function filterUnifiedCatalogHitsExcludingKeys<T extends UnifiedCatalogHit>(
  hits: readonly T[],
  occupiedKeys: ReadonlySet<string>
): T[] {
  if (occupiedKeys.size === 0) return [...hits];
  return hits.filter((h) => !occupiedKeys.has(`${h.source}:${h.id}`));
}
