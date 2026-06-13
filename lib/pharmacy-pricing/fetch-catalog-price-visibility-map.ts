import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPharmacyPricingConfigPublic } from "./api";
import { defaultShowCatalogPricesBeforeResponse } from "./catalog-price-visibility";

/** Préférence officine `show_catalog_prices_before_response` par pharmacie (défaut true). */
export async function fetchCatalogPriceVisibilityByPharmacyIds(
  supabase: SupabaseClient,
  pharmacyIds: readonly string[]
): Promise<Record<string, boolean>> {
  const unique = [...new Set(pharmacyIds.filter(Boolean))];
  const out: Record<string, boolean> = {};
  await Promise.all(
    unique.map(async (pharmacyId) => {
      try {
        const cfg = await fetchPharmacyPricingConfigPublic(supabase, pharmacyId);
        out[pharmacyId] = defaultShowCatalogPricesBeforeResponse(cfg?.settings);
      } catch {
        out[pharmacyId] = true;
      }
    })
  );
  return out;
}
