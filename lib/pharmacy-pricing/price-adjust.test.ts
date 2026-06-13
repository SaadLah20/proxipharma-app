import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldShowCatalogPricesToPatient } from "./catalog-price-visibility.ts";
import {
  describeActivePricingRule,
  isPriceOutsideSoftWarningBand,
  marginPctFromUnitPrice,
} from "./price-adjust.ts";
import type { PharmacyPricingConfig } from "./types.ts";

const sampleConfig: PharmacyPricingConfig = {
  pharmacy_id: "pharmacy-1",
  settings: {
    parapharmacy_mode: "margin_on_pph",
    parapharmacy_margin_pct: 10,
    show_catalog_prices_before_response: true,
  },
  brand_rules: [{ brand_key: "BIOTHERM", brand_display: "Biotherm", margin_pct: 20 }],
  product_overrides: [{ product_id: "prod-1", margin_pct: 25 }],
};

describe("marginPctFromUnitPrice", () => {
  it("computes margin from PPH and unit price", () => {
    assert.equal(marginPctFromUnitPrice(100, 115), 15);
    assert.equal(marginPctFromUnitPrice(100, 90), -10);
  });
});

describe("isPriceOutsideSoftWarningBand", () => {
  it("flags prices beyond PPH+30% or below PPH-10%", () => {
    assert.equal(isPriceOutsideSoftWarningBand(100, 131), true);
    assert.equal(isPriceOutsideSoftWarningBand(100, 130), false);
    assert.equal(isPriceOutsideSoftWarningBand(100, 89), true);
    assert.equal(isPriceOutsideSoftWarningBand(100, 90), false);
  });
});

describe("describeActivePricingRule", () => {
  it("prioritizes product over brand over global", () => {
    assert.equal(
      describeActivePricingRule(sampleConfig, {
        product_id: "prod-1",
        product_type: "parapharmacie",
        price_pph: 100,
        brand: "BIOTHERM",
      }).source,
      "product"
    );

    assert.equal(
      describeActivePricingRule(sampleConfig, {
        product_id: "prod-2",
        product_type: "parapharmacie",
        price_pph: 100,
        brand: "BIOTHERM",
      }).source,
      "brand"
    );

    assert.equal(
      describeActivePricingRule(sampleConfig, {
        product_id: "prod-3",
        product_type: "parapharmacie",
        price_pph: 100,
        brand: "OTHER",
      }).source,
      "global"
    );
  });
});

describe("shouldShowCatalogPricesToPatient", () => {
  it("hides prices before pharmacy response when flag is off", () => {
    assert.equal(shouldShowCatalogPricesToPatient(false, "submitted"), false);
    assert.equal(shouldShowCatalogPricesToPatient(false, "in_review"), false);
    assert.equal(shouldShowCatalogPricesToPatient(false, undefined), false);
  });

  it("shows prices after response when flag is off", () => {
    assert.equal(shouldShowCatalogPricesToPatient(false, "responded"), true);
    assert.equal(shouldShowCatalogPricesToPatient(false, "confirmed"), true);
  });

  it("always shows when flag is on", () => {
    assert.equal(shouldShowCatalogPricesToPatient(true, "submitted"), true);
  });
});
