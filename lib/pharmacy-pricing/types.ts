export type ParapharmacyPricingMode = "at_pph" | "margin_on_pph";

export type PharmacyPricingSettings = {
  parapharmacy_mode: ParapharmacyPricingMode;
  parapharmacy_margin_pct: number;
};

export type PharmacyPricingLaboratoryRule = {
  id?: string;
  laboratory_key: string;
  laboratory_display?: string;
  margin_pct: number;
};

export type PharmacyPricingProductOverride = {
  product_id: string;
  product_name?: string;
  laboratory?: string | null;
  product_type?: string;
  price_pph?: number | null;
  price_ppv?: number | null;
  margin_pct: number;
  resolved_price?: number | null;
};

export type PharmacyPricingConfig = {
  pharmacy_id: string;
  settings: PharmacyPricingSettings;
  laboratory_rules: PharmacyPricingLaboratoryRule[];
  product_overrides: PharmacyPricingProductOverride[];
};

export type ProductPricingInput = {
  product_type: string;
  price_pph?: number | null;
  price_ppv?: number | null;
  laboratory?: string | null;
  product_id?: string;
};

export const PARAPHARMACY_MARGIN_MIN = -10;
export const PARAPHARMACY_MARGIN_MAX = 40;
