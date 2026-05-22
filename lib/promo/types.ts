/** Types offres promo — migration 20260610_001 (workflow séparé des demandes). */

export type PromoOfferStatus = "draft" | "published";

export type PromoOfferLineKind = "product" | "gift";

export type PromoReservationStatus = "submitted" | "confirmed" | "unavailable" | "collected" | "cancelled";

export const MAX_PROMO_PRODUCT_LINES = 5;
export const MAX_PROMO_GIFT_LINES = 5;
export const MAX_PICKUP_DAYS_AHEAD = 3;

export type PromoOfferRow = {
  id: string;
  pharmacy_id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
  status: PromoOfferStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PromoOfferLineRow = {
  id: string;
  offer_id: string;
  line_kind: PromoOfferLineKind;
  sort_order: number;
  product_id: string | null;
  label: string | null;
  quantity: number;
};

export type PromoReservationRow = {
  id: string;
  offer_id: string;
  pharmacy_id: string;
  patient_id: string;
  status: PromoReservationStatus;
  pickup_date: string;
  pickup_time: string | null;
  patient_note: string | null;
  pharmacist_note: string | null;
  public_ref: string | null;
  created_at: string;
  updated_at: string;
};
