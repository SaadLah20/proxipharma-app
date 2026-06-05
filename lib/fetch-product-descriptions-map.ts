import type { SupabaseClient } from "@supabase/supabase-js";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";

/** Descriptions catalogue nettoyées, indexées par `products.id`. */
export async function fetchProductDescriptionsMap(
  supabase: SupabaseClient,
  productIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return map;

  const { data } = await supabase.from("products").select("id, full_description").in("id", ids);
  for (const row of data ?? []) {
    map.set(
      String((row as { id: string }).id),
      productDescriptionHtmlForDisplay((row as { full_description?: string | null }).full_description)
    );
  }
  return map;
}
