import type { CatalogProductSource, UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";
import { catalogHitKey } from "@/lib/pharmacy-catalog-types";

export function catalogHitToRequestItemFields(pick: {
  source: CatalogProductSource;
  id: string;
}) {
  if (pick.source === "pharmacy") {
    return {
      line_product_kind: "pharmacy" as const,
      pharmacy_product_id: pick.id,
      product_id: null,
    };
  }
  return {
    line_product_kind: "global" as const,
    product_id: pick.id,
    pharmacy_product_id: null,
  };
}

export function catalogHitToAlternativeFields(pick: { source: CatalogProductSource; id: string }) {
  return catalogHitToRequestItemFields(pick);
}

export function unifiedCatalogHitKey(hit: UnifiedCatalogHit): string {
  return catalogHitKey(hit);
}

export function requestItemFieldsFromStoredRow(row: {
  product_id?: string | null;
  pharmacy_product_id?: string | null;
  line_product_kind?: string | null;
}) {
  if (row.pharmacy_product_id) {
    return {
      line_product_kind: "pharmacy" as const,
      pharmacy_product_id: row.pharmacy_product_id,
      product_id: null,
    };
  }
  return {
    line_product_kind: "global" as const,
    product_id: row.product_id ?? null,
    pharmacy_product_id: null,
  };
}

export function mapUnifiedCatalogHitsPhotoUrls(
  hits: UnifiedCatalogHit[],
  resolveUrl: (url: string | null) => string | null
): UnifiedCatalogHit[] {
  return hits.map((h) => ({
    ...h,
    photo_url: h.photo_url ? resolveUrl(h.photo_url) : null,
  }));
}
