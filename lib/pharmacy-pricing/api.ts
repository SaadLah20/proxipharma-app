import type { SupabaseClient } from "@supabase/supabase-js";
import type { PharmacyPricingConfig } from "./types";

export async function fetchPharmacistPricingConfig(
  supabase: SupabaseClient
): Promise<PharmacyPricingConfig | null> {
  const { data, error } = await supabase.rpc("pharmacist_pricing_config_get");
  if (error) throw error;
  if (!data) return null;
  return data as PharmacyPricingConfig;
}

export async function savePharmacistPricingConfig(
  supabase: SupabaseClient,
  config: PharmacyPricingConfig
): Promise<PharmacyPricingConfig | null> {
  const payload = {
    settings: config.settings,
    brand_rules: config.brand_rules.map((r) => ({
      brand_key: r.brand_key,
      margin_pct: r.margin_pct,
    })),
    product_overrides: config.product_overrides.map((o) => ({
      product_id: o.product_id,
      margin_pct: o.margin_pct,
    })),
  };
  const { data, error } = await supabase.rpc("pharmacist_pricing_config_save", {
    p_payload: payload,
  });
  if (error) throw error;
  return (data as PharmacyPricingConfig | null) ?? null;
}

export type DistinctBrandRow = {
  brand_key: string;
  brand_display: string;
  product_count: number;
};

export async function fetchDistinctParapharmacyBrands(
  supabase: SupabaseClient
): Promise<DistinctBrandRow[]> {
  const { data, error } = await supabase.rpc("pharmacist_pricing_distinct_brands");
  if (error) throw error;
  return (data ?? []) as DistinctBrandRow[];
}

export async function fetchPharmacyPricingConfigPublic(
  supabase: SupabaseClient,
  pharmacyId: string
): Promise<PharmacyPricingConfig | null> {
  const { data, error } = await supabase.rpc("pharmacy_pricing_config_public_get", {
    p_pharmacy_id: pharmacyId,
  });
  if (error) throw error;
  if (!data) return null;
  return data as PharmacyPricingConfig;
}
