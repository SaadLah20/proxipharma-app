import { supabase } from "@/lib/supabase";
import { MAX_PROMO_GIFT_LINES, MAX_PROMO_PRODUCT_LINES } from "@/lib/promo/types";

export type PromoLineDraft = {
  line_kind: "product" | "gift";
  product_id: string | null;
  label: string | null;
  quantity: number;
};

export type PromoOfferDraft = {
  title: string;
  description: string;
  discount_percent: number;
  valid_from: string;
  valid_until: string;
};

export async function savePromoOffer(
  pharmacyId: string,
  offerId: string | null,
  offer: PromoOfferDraft,
  lines: PromoLineDraft[],
  publish: boolean,
  existingStatus?: "draft" | "published" | null
): Promise<{ offerId: string | null; error: string | null }> {
  const products = lines.filter((l) => l.line_kind === "product");
  const gifts = lines.filter((l) => l.line_kind === "gift");
  if (!offer.title.trim()) return { offerId: null, error: "Titre obligatoire." };
  if (!offer.valid_from || !offer.valid_until) return { offerId: null, error: "Dates de validité obligatoires." };
  if (offer.valid_until < offer.valid_from) return { offerId: null, error: "La date de fin doit être après le début." };
  if (offer.discount_percent < 1 || offer.discount_percent > 99) {
    return { offerId: null, error: "Remise entre 1 % et 99 %." };
  }
  if (products.length < 1) return { offerId: null, error: "Ajoutez au moins un produit au pack." };
  if (products.length > MAX_PROMO_PRODUCT_LINES) {
    return { offerId: null, error: `Maximum ${MAX_PROMO_PRODUCT_LINES} produits.` };
  }
  if (gifts.length > MAX_PROMO_GIFT_LINES) return { offerId: null, error: `Maximum ${MAX_PROMO_GIFT_LINES} cadeaux.` };

  const row: Record<string, unknown> = {
    pharmacy_id: pharmacyId,
    title: offer.title.trim(),
    description: offer.description.trim() || null,
    discount_percent: offer.discount_percent,
    valid_from: offer.valid_from,
    valid_until: offer.valid_until,
  };
  if (publish) {
    row.status = "published";
    row.published_at = new Date().toISOString();
  } else if (existingStatus !== "published") {
    row.status = "draft";
  }

  let id = offerId;
  if (id) {
    const { error } = await supabase.from("pharmacy_promo_offers").update(row).eq("id", id);
    if (error) return { offerId: null, error: error.message };
  } else {
    const { data, error } = await supabase.from("pharmacy_promo_offers").insert(row).select("id").single();
    if (error) return { offerId: null, error: error.message };
    id = data.id as string;
  }

  await supabase.from("pharmacy_promo_offer_lines").delete().eq("offer_id", id);

  const lineRows = lines.map((l, i) => ({
    offer_id: id,
    line_kind: l.line_kind,
    sort_order: i,
    product_id: l.line_kind === "product" ? l.product_id : l.product_id || null,
    label: l.line_kind === "gift" && !l.product_id ? (l.label?.trim() || null) : l.label?.trim() || null,
    quantity: l.quantity,
  }));

  const { error: le } = await supabase.from("pharmacy_promo_offer_lines").insert(lineRows);
  if (le) return { offerId: id, error: le.message };

  return { offerId: id, error: null };
}

export async function deletePromoOffer(offerId: string): Promise<string | null> {
  const { error } = await supabase.from("pharmacy_promo_offers").delete().eq("id", offerId);
  return error?.message ?? null;
}
