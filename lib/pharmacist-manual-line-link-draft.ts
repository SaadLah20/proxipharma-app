import { catalogHitToRequestItemFields } from "@/lib/pharmacy-catalog-request-insert";
import type { UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";

type ManualLinkDraftEmbed = {
  name: string;
  product_type: string;
  brand: string | null;
  laboratory: string | null;
  photo_url: string | null;
  price_pph: number | null;
  price_ppv: number | null;
  full_description: string | null;
};

export function catalogHitToManualLinkEmbed(hit: UnifiedCatalogHit): ManualLinkDraftEmbed {
  return {
    name: hit.name,
    product_type: hit.product_type,
    brand: hit.brand,
    laboratory: hit.laboratory,
    photo_url: hit.photo_url,
    price_pph: hit.price_pph,
    price_ppv: hit.price_ppv,
    full_description: hit.full_description,
  };
}

/** Prévisualisation UI : ligne manuelle + produit catalogue choisi (pas encore en base). */
export function itemRowWithManualLinkDraft<T extends {
  product_id: string | null;
  pharmacy_product_id?: string | null;
  line_product_kind?: string | null;
  products: unknown;
  pharmacy_catalog_products?: unknown;
}>(row: T, hit: UnifiedCatalogHit): T {
  const fields = catalogHitToRequestItemFields(hit);
  const embed = catalogHitToManualLinkEmbed(hit);
  return {
    ...row,
    product_id: fields.product_id,
    pharmacy_product_id: fields.pharmacy_product_id,
    line_product_kind: fields.line_product_kind,
    products: hit.source === "global" ? embed : null,
    pharmacy_catalog_products: hit.source === "pharmacy" ? embed : null,
  };
}
