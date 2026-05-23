/**
 * Affichage prix catalogue / lignes demande.
 * Source de vérité officine : `lib/pharmacy-pricing` (PPV médicaments, PPH+marge parapharmacie).
 */

import type { PharmacyPricingConfig, ProductPricingInput } from "@/lib/pharmacy-pricing";
import { resolveLineUnitPrice, resolvePharmacyUnitPrice } from "@/lib/pharmacy-pricing";

export type ProductPriceEmbed = {
  product_type?: string | null;
  price_pph?: number | string | null;
  price_ppv?: number | string | null;
  laboratory?: string | null;
  product_id?: string;
};

export function formatPphMad(pricePph: number | string | null | undefined): string | null {
  if (pricePph == null || pricePph === "") return null;
  const n = typeof pricePph === "string" ? Number(pricePph) : pricePph;
  if (Number.isNaN(n) || n < 0) return null;
  return `${n.toFixed(2)} MAD`;
}

/** Libellé court pour badge à côté du nom (“PPH …”) */
export function pphLabel(pricePph: number | string | null | undefined): string | null {
  const mad = formatPphMad(pricePph);
  return mad ? `PPH ${mad}` : null;
}

/** Libellé patient-friendly (“Prix unitaire …”) — valeur déjà résolue officine. */
export function unitPriceLabel(resolvedPrice: number | string | null | undefined): string | null {
  const dh = formatPriceDh(resolvedPrice);
  return dh !== "—" ? `Prix unitaire ${dh.replace("\u00A0", " ")}` : null;
}

/** Prix catalogue officine (patient / pharmacien affichage catalogue). */
export function formatPharmacyCatalogPrice(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput | null | undefined
): string {
  return formatPriceDh(resolvePharmacyUnitPrice(config, product));
}

/** Prix ligne : saisie pharmacien ou résolution catalogue. */
export function formatPharmacyLinePrice(
  config: PharmacyPricingConfig | null | undefined,
  product: ProductPricingInput | null | undefined,
  unitPriceOnLine?: number | string | null
): string {
  const line =
    unitPriceOnLine != null && unitPriceOnLine !== ""
      ? Number(unitPriceOnLine)
      : null;
  const resolved = resolveLineUnitPrice(
    config,
    product,
    line != null && !Number.isNaN(line) ? line : null
  );
  return formatPriceDh(resolved);
}

/** Montant indicatif en dirhams (UI patient : libellé court « … DH »). */
export function formatPriceDh(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || n < 0) return "—";
  // Espace insécable : évite le retour à la ligne entre le montant et « DH » sur mobile.
  return `${n.toFixed(2)}\u00A0DH`;
}
