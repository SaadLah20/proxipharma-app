import { normalizeBrandKey } from "./normalize";
import type { PharmacyPricingConfig, ProductPricingInput } from "./types";
import { PARAPHARMACY_MARGIN_MAX, PARAPHARMACY_MARGIN_MIN } from "./types";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampParapharmacyMargin(pct: number): number {
  return Math.min(PARAPHARMACY_MARGIN_MAX, Math.max(PARAPHARMACY_MARGIN_MIN, pct));
}

export function marginPctFromUnitPrice(pph: number, unitPrice: number): number {
  if (!Number.isFinite(pph) || pph <= 0 || !Number.isFinite(unitPrice)) {
    return NaN;
  }
  return round2((unitPrice / pph - 1) * 100);
}

export function unitPriceFromMarginPct(pph: number, marginPct: number): number {
  if (!Number.isFinite(pph) || pph <= 0 || !Number.isFinite(marginPct)) {
    return NaN;
  }
  return round2(pph * (1 + marginPct / 100));
}

export type PricingRuleSource = "product" | "brand" | "global" | "default";

export type ActivePricingRule = {
  source: PricingRuleSource;
  marginPct: number;
  labelFr: string;
};

export function describeActivePricingRule(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput | null | undefined
): ActivePricingRule {
  if (!product || product.product_type === "medicament") {
    return { source: "default", marginPct: 0, labelFr: "PPV catalogue (médicament)" };
  }

  const productId = product.product_id;
  if (productId && config) {
    const override = config.product_overrides.find((o) => o.product_id === productId);
    if (override != null) {
      return {
        source: "product",
        marginPct: override.margin_pct,
        labelFr: "Produit spécifique",
      };
    }
  }

  const brandKey = normalizeBrandKey(product.brand);
  if (brandKey && config) {
    const brandRule = config.brand_rules.find((r) => r.brand_key === brandKey);
    if (brandRule != null) {
      return {
        source: "brand",
        marginPct: brandRule.margin_pct,
        labelFr: `Marque : ${brandRule.brand_display ?? brandKey}`,
      };
    }
  }

  if (!config || config.settings.parapharmacy_mode === "at_pph") {
    return { source: "global", marginPct: 0, labelFr: "Règle générale (PPH)" };
  }

  return {
    source: "global",
    marginPct: config.settings.parapharmacy_margin_pct,
    labelFr: "Règle générale",
  };
}

/** Bande douce : au-delà de PPH+30 % ou sous PPH−10 % (avertissement non bloquant). */
export function isPriceOutsideSoftWarningBand(pph: number, price: number): boolean {
  if (!Number.isFinite(pph) || pph <= 0 || !Number.isFinite(price)) return false;
  return price > round2(pph * 1.3) || price < round2(pph * 0.9);
}

export function isMarginWithinHardBounds(marginPct: number): boolean {
  return Number.isFinite(marginPct) && marginPct >= PARAPHARMACY_MARGIN_MIN && marginPct <= PARAPHARMACY_MARGIN_MAX;
}

export function hasProductPricingOverride(
  config: PharmacyPricingConfig | null | undefined,
  productId: string | null | undefined
): boolean {
  if (!config || !productId) return false;
  return config.product_overrides.some((o) => o.product_id === productId);
}

/** Ajustement PU pré-réponse : parapharmacie catalogue national uniquement. */
export function canPharmacistAdjustNationalParaLinePrice(args: {
  canEditLinePrice: boolean;
  productType?: string | null;
  productId?: string | null;
  pricePph?: number | string | null;
}): boolean {
  if (!args.canEditLinePrice) return false;
  if (args.productType === "medicament") return false;
  if (!args.productId) return false;
  const pph = args.pricePph != null && args.pricePph !== "" ? Number(args.pricePph) : null;
  if (pph == null || Number.isNaN(pph) || pph <= 0) return false;
  return true;
}
