import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";

export type ProductsCatalogSearchHit = {
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
  laboratory: string | null;
  photo_url: string | null;
  price_pph: number | null;
  price_ppv: number | null;
  full_description: string | null;
};

export type ProductsCatalogSearchOptions = {
  query: string;
  productType?: string | null;
  brand?: string | null;
  offset?: number;
  limit?: number;
};

function mapRpcHit(row: Record<string, unknown>): ProductsCatalogSearchHit {
  return {
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

/** Recherche catalogue national avec ranking préfixe (RPC `products_catalog_search`). */
export async function searchProductsCatalog(
  supabase: SupabaseClient,
  options: ProductsCatalogSearchOptions
): Promise<ProductsCatalogSearchHit[]> {
  const sanitized = sanitizeProductSearchQuery(options.query);
  if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
    return [];
  }

  const productType =
    options.productType && options.productType !== "all" ? options.productType : null;
  const brand = options.brand?.trim() ? options.brand.trim() : null;

  const { data, error } = await supabase.rpc("products_catalog_search", {
    p_query: sanitized,
    p_product_type: productType,
    p_brand: brand,
    p_offset: options.offset ?? 0,
    p_limit: options.limit ?? 60,
  });

  if (error) throw error;
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapRpcHit(row as Record<string, unknown>));
}
