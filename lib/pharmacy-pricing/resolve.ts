import type { PharmacyPricingConfig, ProductPricingInput } from "./types";
import { normalizeBrandKey } from "./normalize";

function roundMad(value: number): number {
  return Math.round(value * 100) / 100;
}

function marginForParapharmacy(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput
): number {
  if (!config) return 0;

  const productId = product.product_id;
  if (productId) {
    const override = config.product_overrides.find((o) => o.product_id === productId);
    if (override != null) return override.margin_pct;
  }

  const brandKey = normalizeBrandKey(product.brand);
  if (brandKey) {
    const brandRule = config.brand_rules.find((r) => r.brand_key === brandKey);
    if (brandRule != null) return brandRule.margin_pct;
  }

  if (config.settings.parapharmacy_mode === "at_pph") return 0;
  return config.settings.parapharmacy_margin_pct;
}

/** Prix unitaire catalogue pour une officine (médicament = PPV ; para = PPH + marge). */
export function resolvePharmacyUnitPrice(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput | null | undefined
): number | null {
  if (!product) return null;

  if (product.product_type === "medicament") {
    const ppv = product.price_ppv;
    if (ppv == null || Number.isNaN(Number(ppv))) return null;
    return roundMad(Number(ppv));
  }

  const pph = product.price_pph;
  if (pph == null || Number.isNaN(Number(pph))) return null;

  const margin = marginForParapharmacy(config, product);
  return roundMad(Number(pph) * (1 + margin / 100));
}

/** Affichage ligne : prix saisi pharmacien, sinon prix résolu. */
export function resolveLineUnitPrice(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput | null | undefined,
  unitPriceOnLine?: number | null
): number | null {
  if (unitPriceOnLine != null && !Number.isNaN(Number(unitPriceOnLine))) {
    return roundMad(Number(unitPriceOnLine));
  }
  return resolvePharmacyUnitPrice(config, product);
}
