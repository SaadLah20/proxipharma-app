import { one } from "@/lib/embed";

export type RequestLineProductEmbed = {
  name?: string | null;
  product_type?: string | null;
  brand?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  photo_url?: string | null;
  full_description?: string | null;
};

type EmbeddableRow = {
  products?: RequestLineProductEmbed | RequestLineProductEmbed[] | null;
  pharmacy_catalog_products?: RequestLineProductEmbed | RequestLineProductEmbed[] | null;
};

const PRODUCT_EMBED_PRICE_FIELDS = "price_pph,price_ppv,product_type";

/** Hub listes patient/pharmacien — totaux cartes (sans embed catalogue dans les alternatives : limite profondeur PostgREST). */
export const REQUEST_ITEMS_HUB_SUMMARY_EMBED_SELECT = `requested_qty,selected_qty,available_qty,unit_price,is_selected_by_patient,line_source,patient_chosen_alternative_id,counter_outcome,post_confirm_fulfillment,availability_status,products(${PRODUCT_EMBED_PRICE_FIELDS}),pharmacy_catalog_products(${PRODUCT_EMBED_PRICE_FIELDS}),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,unit_price)`;

const PRODUCT_EMBED_FIELDS =
  "name,product_type,brand,laboratory,price_pph,price_ppv,photo_url,full_description";

/** Select PostgREST : lignes + alternatives avec embed global et catalogue privé officine. */
export const REQUEST_ITEM_ALTERNATIVES_CATALOG_EMBED_SELECT = `id,rank,product_id,pharmacy_product_id,line_product_kind,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(${PRODUCT_EMBED_FIELDS}),pharmacy_catalog_products(${PRODUCT_EMBED_FIELDS})`;

export const REQUEST_ITEMS_CATALOG_EMBED_SELECT = `id,product_id,pharmacy_product_id,line_product_kind,patient_requested_label,manual_resolved_at,requested_qty,selected_qty,is_selected_by_patient,availability_status,available_qty,unit_price,pharmacist_comment,client_comment,line_source,pharmacist_proposal_reason,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,updated_at,products(${PRODUCT_EMBED_FIELDS}),pharmacy_catalog_products(${PRODUCT_EMBED_FIELDS}),request_item_alternatives!request_item_alternatives_request_item_id_fkey(${REQUEST_ITEM_ALTERNATIVES_CATALOG_EMBED_SELECT})`;

/** Nom + métadonnées produit d'une ligne (global ou catalogue privé officine). */
export function requestLineProductEmbed(row: EmbeddableRow | null | undefined): RequestLineProductEmbed | null {
  if (!row) return null;
  return one(row.pharmacy_catalog_products) ?? one(row.products) ?? null;
}

type EmbeddableRowWithManual = EmbeddableRow & {
  line_product_kind?: string | null;
  patient_requested_label?: string | null;
};

export function requestLineProductName(row: EmbeddableRowWithManual | null | undefined, fallback = "Produit"): string {
  if (row?.line_product_kind === "patient_manual") {
    return row.patient_requested_label?.trim() || fallback;
  }
  return requestLineProductEmbed(row)?.name?.trim() || fallback;
}

/** Identifiant catalogue pour résolution prix (global ou privé officine). */
export function requestLineCatalogProductId(row: {
  product_id?: string | null;
  pharmacy_product_id?: string | null;
}): string | undefined {
  return row.pharmacy_product_id ?? row.product_id ?? undefined;
}

/** Normalise les lignes chargées : expose toujours `products` pour l'UI existante. */
export function normalizeRequestItemRowEmbed<T extends EmbeddableRowWithManual>(row: T): T {
  if (row.line_product_kind === "patient_manual" && row.patient_requested_label?.trim()) {
    if (one(row.products)) return row;
    return { ...row, products: { name: row.patient_requested_label.trim() } };
  }
  const embed = requestLineProductEmbed(row);
  if (!embed) return row;
  if (one(row.products)) return row;
  return { ...row, products: embed };
}

type EmbeddableRowWithAlts = EmbeddableRow & {
  request_item_alternatives?: EmbeddableRow | EmbeddableRow[] | null;
};

/** Normalise la ligne et chaque alternative (catalogue privé → `products`). */
export function normalizeRequestItemTreeEmbed<T extends EmbeddableRowWithAlts>(row: T): T {
  const normalizedRow = normalizeRequestItemRowEmbed(row);
  const rawAlts = normalizedRow.request_item_alternatives;
  if (!rawAlts) return normalizedRow;
  const list = Array.isArray(rawAlts) ? rawAlts : [rawAlts];
  const normalizedList = list.map((alt) => normalizeRequestItemRowEmbed(alt));
  return {
    ...normalizedRow,
    request_item_alternatives: (Array.isArray(rawAlts) ? normalizedList : normalizedList[0] ?? null) as T["request_item_alternatives"],
  };
}
