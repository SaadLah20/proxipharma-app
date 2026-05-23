import type { PromoOfferLineRow } from "@/lib/promo/types";

export type PromoLineWithPrice = PromoOfferLineRow & {
  product_name?: string | null;
  price_pph?: number | null;
  photo_url?: string | null;
};

export function computePromoPackTotals(lines: PromoLineWithPrice[], discountPercent: number) {
  let subtotal = 0;
  for (const line of lines) {
    if (line.line_kind !== "product" || !line.product_id) continue;
    const p = line.price_pph ?? 0;
    subtotal += p * line.quantity;
  }
  const discount = (subtotal * discountPercent) / 100;
  const total = Math.max(0, subtotal - discount);
  return { subtotal, discount, total };
}

export function formatDh(amount: number): string {
  return `${amount.toFixed(2)} DH`;
}
