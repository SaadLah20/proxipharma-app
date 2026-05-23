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
    laboratory_rules: config.laboratory_rules.map((r) => ({
      laboratory_key: r.laboratory_key,
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

export type DistinctLaboratoryRow = {
  laboratory_key: string;
  laboratory_display: string;
  product_count: number;
};

export async function fetchDistinctParapharmacyLaboratories(
  supabase: SupabaseClient
): Promise<DistinctLaboratoryRow[]> {
  const { data, error } = await supabase.rpc("pharmacist_pricing_distinct_laboratories");
  if (error) throw error;
  return (data ?? []) as DistinctLaboratoryRow[];
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
