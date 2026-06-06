import type { ProductPricingInput } from "./types";

export type ProductEmbedLike = {
  product_type?: string | null;
  price_pph?: number | string | null;
  price_ppv?: number | string | null;
  brand?: string | null;
};

export function productEmbedToPricingInput(
  product: ProductEmbedLike | null | undefined,
  productId?: string
): ProductPricingInput | null {
  if (!product?.product_type) return null;
  return {
    product_id: productId,
    product_type: product.product_type,
    price_pph:
      product.price_pph != null && product.price_pph !== ""
        ? Number(product.price_pph)
        : null,
    price_ppv:
      product.price_ppv != null && product.price_ppv !== ""
        ? Number(product.price_ppv)
        : null,
    brand: product.brand ?? null,
  };
}

export function catalogHitToPricingInput(hit: {
  id: string;
  product_type: string;
  price_pph?: number | null;
  price_ppv?: number | null;
  brand?: string | null;
}): ProductPricingInput {
  return {
    product_id: hit.id,
    product_type: hit.product_type,
    price_pph: hit.price_pph ?? null,
    price_ppv: hit.price_ppv ?? null,
    brand: hit.brand ?? null,
  };
}
