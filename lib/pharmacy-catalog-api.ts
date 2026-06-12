import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PharmacyCatalogProductFormValues,
  PharmacyCatalogProductRow,
  PharmacyCatalogProductStatus,
  UnifiedCatalogHit,
} from "@/lib/pharmacy-catalog-types";

function parseOptionalPrice(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formToRpcPayload(values: PharmacyCatalogProductFormValues) {
  return {
    p_name: values.name.trim(),
    p_product_type: values.product_type,
    p_price_pph: values.product_type === "parapharmacie" ? parseOptionalPrice(values.price_pph) : null,
    p_price_ppv: values.product_type === "medicament" ? parseOptionalPrice(values.price_ppv) : null,
    p_brand: values.brand.trim() || null,
    p_laboratory: values.laboratory.trim() || null,
    p_photo_url: values.photo_url.trim() || null,
    p_short_description: values.short_description.trim() || null,
    p_full_description: values.full_description.trim() || null,
    p_form: null,
    p_category: null,
    p_subcategory: null,
  };
}

export function pharmacyCatalogRowToHit(row: PharmacyCatalogProductRow): UnifiedCatalogHit {
  return {
    source: "pharmacy",
    id: row.id,
    name: row.name,
    product_type: row.product_type,
    brand: row.brand,
    laboratory: row.laboratory,
    photo_url: row.photo_url,
    price_pph: row.price_pph,
    price_ppv: row.price_ppv,
    full_description: row.full_description,
  };
}

export async function createPharmacyCatalogProduct(
  supabase: SupabaseClient,
  values: PharmacyCatalogProductFormValues
): Promise<PharmacyCatalogProductRow> {
  const { data, error } = await supabase.rpc("pharmacist_create_pharmacy_product", formToRpcPayload(values));
  if (error) throw error;
  return data as PharmacyCatalogProductRow;
}

export async function updatePharmacyCatalogProduct(
  supabase: SupabaseClient,
  productId: string,
  values: PharmacyCatalogProductFormValues
): Promise<PharmacyCatalogProductRow> {
  const { data, error } = await supabase.rpc("pharmacist_update_pharmacy_product", {
    p_product_id: productId,
    ...formToRpcPayload(values),
  });
  if (error) throw error;
  return data as PharmacyCatalogProductRow;
}

export async function unpublishPharmacyCatalogProduct(
  supabase: SupabaseClient,
  productId: string
): Promise<PharmacyCatalogProductRow> {
  const { data, error } = await supabase.rpc("pharmacist_unpublish_pharmacy_product", {
    p_product_id: productId,
  });
  if (error) throw error;
  return data as PharmacyCatalogProductRow;
}

export async function republishPharmacyCatalogProduct(
  supabase: SupabaseClient,
  productId: string
): Promise<PharmacyCatalogProductRow> {
  const { data, error } = await supabase.rpc("pharmacist_republish_pharmacy_product", {
    p_product_id: productId,
  });
  if (error) throw error;
  return data as PharmacyCatalogProductRow;
}

export async function listPharmacyCatalogProducts(
  supabase: SupabaseClient,
  status?: PharmacyCatalogProductStatus | null
): Promise<PharmacyCatalogProductRow[]> {
  const { data, error } = await supabase.rpc("pharmacist_list_pharmacy_products", {
    p_status: status ?? null,
  });
  if (error) throw error;
  return (data ?? []) as PharmacyCatalogProductRow[];
}

export async function pharmacyProductUsedInResponse(
  supabase: SupabaseClient,
  productId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("pharmacy_product_used_in_response", {
    p_pharmacy_product_id: productId,
  });
  if (error) throw error;
  return Boolean(data);
}
