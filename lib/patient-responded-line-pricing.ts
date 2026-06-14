import type { ProductEmbedLike } from "@/lib/pharmacy-pricing/product-embed";

export type RespondedProdBrief = {
  product_type?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  brand?: string | null;
};

export type RespondedCatalogUnitPriceResolver = (
  productId: string,
  prod: RespondedProdBrief | null
) => number | null;

/** PU ligne répondue : saisie officine, sinon catalogue (médicament = PPV uniquement). */
export function resolvedRespondedUnitPrice(
  stored: number | null | undefined,
  productId: string | null | undefined,
  prod: RespondedProdBrief | null,
  resolveCatalog?: RespondedCatalogUnitPriceResolver
): number | null {
  if (prod?.product_type === "medicament") {
    if (productId && resolveCatalog) {
      return resolveCatalog(productId, prod);
    }
    const ppv = prod.price_ppv;
    if (ppv != null && Number.isFinite(Number(ppv))) return Number(ppv);
    return null;
  }

  if (stored != null && Number.isFinite(Number(stored))) return Number(stored);
  if (!productId) return null;
  return resolveCatalog?.(productId, prod) ?? null;
}
