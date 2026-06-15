import type { SupabaseClient } from "@supabase/supabase-js";
import type { PharmacyCatalogProductStatus } from "@/lib/pharmacy-catalog-types";

export type AdminCommunityCatalogRow = {
  id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_ville: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  name: string;
  product_type: "medicament" | "parapharmacie";
  price_pph: number | null;
  price_ppv: number | null;
  brand: string | null;
  laboratory: string | null;
  photo_url: string | null;
  short_description: string | null;
  full_description: string | null;
  form: string | null;
  category: string | null;
  subcategory: string | null;
  status: PharmacyCatalogProductStatus;
  promoted_product_id: string | null;
  promoted_at: string | null;
  pharmacist_name: string | null;
  event_count: number;
};

export type AdminCommunityCatalogEnrichInput = {
  name?: string;
  product_type?: "medicament" | "parapharmacie";
  price_pph?: number | null;
  price_ppv?: number | null;
  brand?: string | null;
  laboratory?: string | null;
  photo_url?: string | null;
  short_description?: string | null;
  full_description?: string | null;
  form?: string | null;
  category?: string | null;
  subcategory?: string | null;
  notes?: string | null;
};

export type AdminCommunityCatalogEvent = {
  id: string;
  pharmacy_product_id: string;
  event_type: string;
  actor_id: string | null;
  snapshot: Record<string, unknown>;
  notes: string | null;
  created_at: string;
};

function parseOptionalPrice(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function adminCommunityRowToFormValues(row: AdminCommunityCatalogRow) {
  return {
    name: row.name,
    product_type: row.product_type,
    price_pph: row.price_pph != null ? String(row.price_pph) : "",
    price_ppv: row.price_ppv != null ? String(row.price_ppv) : "",
    brand: row.brand ?? "",
    laboratory: row.laboratory ?? "",
    photo_url: row.photo_url ?? "",
    short_description: row.short_description ?? "",
    full_description: row.full_description ?? "",
    form: row.form ?? "",
    category: row.category ?? "",
    subcategory: row.subcategory ?? "",
    notes: "",
  };
}

export type AdminCommunityCatalogFormValues = ReturnType<typeof adminCommunityRowToFormValues>;

export async function countPendingCommunityCatalogProducts(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("admin_count_pending_community_catalog_products");
  if (error) throw error;
  return Number(data ?? 0);
}

export async function listAdminCommunityCatalogProducts(
  supabase: SupabaseClient,
  status?: PharmacyCatalogProductStatus | null
): Promise<AdminCommunityCatalogRow[]> {
  const { data, error } = await supabase.rpc("admin_list_pharmacy_catalog_products", {
    p_status: status ?? null,
    p_limit: 200,
    p_offset: 0,
  });
  if (error) throw error;
  return (data ?? []) as AdminCommunityCatalogRow[];
}

export async function enrichAdminCommunityCatalogProduct(
  supabase: SupabaseClient,
  productId: string,
  values: AdminCommunityCatalogFormValues
): Promise<AdminCommunityCatalogRow> {
  const { data, error } = await supabase.rpc("admin_enrich_pharmacy_catalog_product", {
    p_product_id: productId,
    p_name: values.name.trim(),
    p_product_type: values.product_type,
    p_price_pph: values.product_type === "parapharmacie" ? parseOptionalPrice(values.price_pph) : null,
    p_price_ppv: values.product_type === "medicament" ? parseOptionalPrice(values.price_ppv) : null,
    p_brand: values.brand.trim() || null,
    p_laboratory: values.laboratory.trim() || null,
    p_photo_url: values.photo_url.trim() || null,
    p_short_description: values.short_description.trim() || null,
    p_full_description: values.full_description.trim() || null,
    p_form: values.form.trim() || null,
    p_category: values.category.trim() || null,
    p_subcategory: values.subcategory.trim() || null,
    p_notes: values.notes.trim() || null,
  });
  if (error) throw error;
  return data as AdminCommunityCatalogRow;
}

export async function publishAdminCommunityCatalogProduct(
  supabase: SupabaseClient,
  productId: string,
  options?: { forceDuplicate?: boolean; notes?: string }
): Promise<{ pharmacy_product: AdminCommunityCatalogRow; global_product: { id: string; name: string } }> {
  const { data, error } = await supabase.rpc("admin_publish_pharmacy_product_to_global", {
    p_product_id: productId,
    p_force_duplicate: options?.forceDuplicate ?? false,
    p_notes: options?.notes?.trim() || null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { pharmacy_product: AdminCommunityCatalogRow; global_product: { id: string; name: string } };
}

export async function listAdminCommunityCatalogEvents(
  supabase: SupabaseClient,
  productId: string
): Promise<AdminCommunityCatalogEvent[]> {
  const { data, error } = await supabase.rpc("admin_list_pharmacy_catalog_product_events", {
    p_product_id: productId,
    p_limit: 30,
  });
  if (error) throw error;
  return (data ?? []) as AdminCommunityCatalogEvent[];
}

export function adminCommunityEventLabelFr(eventType: string): string {
  switch (eventType) {
    case "created":
      return "Créé par le pharmacien";
    case "updated_by_pharmacist":
      return "Modifié par le pharmacien";
    case "unpublished":
      return "Dépublié";
    case "republished":
      return "Republé";
    case "admin_enriched":
      return "Enrichi (admin)";
    case "published":
      return "Publié au catalogue national";
    case "archived_by_pharmacist":
      return "Masqué par le pharmacien";
    case "restored_by_pharmacist":
      return "Restauré par le pharmacien";
    case "rejected":
      return "Rejeté";
    default:
      return eventType;
  }
}
