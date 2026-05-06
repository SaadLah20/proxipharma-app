/**
 * PPH = prix depuis le référentiel `products.price_pph` (indicatif catalogue).
 */

export type ProductPriceEmbed = {
  price_pph?: number | string | null;
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

/** Libellé patient-friendly (“Prix unitaire …”) */
export function unitPriceLabel(pricePph: number | string | null | undefined): string | null {
  const mad = formatPphMad(pricePph);
  return mad ? `Prix unitaire ${mad}` : null;
}
