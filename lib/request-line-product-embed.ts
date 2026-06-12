import { one } from "@/lib/embed";

export type RequestLineProductEmbed = {
  name: string;
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

/** Nom + métadonnées produit d'une ligne (global ou catalogue privé officine). */
export function requestLineProductEmbed(row: EmbeddableRow | null | undefined): RequestLineProductEmbed | null {
  if (!row) return null;
  return one(row.pharmacy_catalog_products) ?? one(row.products) ?? null;
}

export function requestLineProductName(row: EmbeddableRow | null | undefined, fallback = "Produit"): string {
  return requestLineProductEmbed(row)?.name?.trim() || fallback;
}

/** Normalise les lignes chargées : expose toujours `products` pour l'UI existante. */
export function normalizeRequestItemRowEmbed<T extends EmbeddableRow>(row: T): T {
  const embed = requestLineProductEmbed(row);
  if (!embed) return row;
  if (one(row.products)) return row;
  return { ...row, products: embed };
}
