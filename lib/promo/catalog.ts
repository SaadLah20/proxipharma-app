import { supabase } from "@/lib/supabase";
import { PRODUCT_CATALOG_SELECT } from "@/lib/product-catalog-search";

export type PromoCatalogProduct = {
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
  laboratory: string | null;
  price_pph: number | null;
  price_ppv: number | null;
  photo_url: string | null;
  full_description?: string | null;
};

export async function fetchPromoCatalogProductsByIds(ids: string[]): Promise<PromoCatalogProduct[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return [];

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CATALOG_SELECT)
    .in("id", unique)
    .eq("is_active", true);

  if (error || !data) return [];
  return data as PromoCatalogProduct[];
}

export function mergePromoCatalogById(
  prev: Record<string, PromoCatalogProduct>,
  products: PromoCatalogProduct[],
): Record<string, PromoCatalogProduct> {
  if (!products.length) return prev;
  const next = { ...prev };
  for (const p of products) next[p.id] = p;
  return next;
}
