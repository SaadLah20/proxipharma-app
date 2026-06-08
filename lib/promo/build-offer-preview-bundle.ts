import { todayIsoCasablanca } from "@/lib/promo/dates";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoOfferDraft } from "@/lib/promo/save-offer";
import type { PromoOfferRow } from "@/lib/promo/types";
import type { PromoCatalogProduct } from "@/lib/promo/catalog";

export type PromoPreviewLineInput = {
  line_kind: "product" | "gift";
  product_id: string | null;
  label: string | null;
  quantity: number;
  _name?: string;
  _key?: string;
};

export function buildPromoPreviewLines(
  lines: PromoPreviewLineInput[],
  catalog: PromoCatalogProduct[],
  resolveUnitPrice?: (productId: string, catalogPph: number | null) => number | null
): PromoLineWithPrice[] {
  return lines.map((l, i) => {
    const cat = l.product_id ? catalog.find((c) => c.id === l.product_id) : null;
    const catalogPph = cat?.price_pph ?? null;
    const price_pph =
      l.product_id && resolveUnitPrice
        ? resolveUnitPrice(l.product_id, catalogPph)
        : catalogPph;

    return {
      id: l._key ?? `preview-line-${i}`,
      offer_id: "",
      line_kind: l.line_kind,
      sort_order: i,
      product_id: l.product_id,
      label: l.label,
      quantity: l.quantity,
      product_name: l._name ?? cat?.name ?? l.label,
      price_pph,
      photo_url: cat?.photo_url ?? null,
      brand: cat?.brand ?? null,
      product_type: cat?.product_type ?? null,
      full_description: cat?.full_description ?? null,
    };
  });
}

export function draftToPreviewOfferRow(
  pharmacyId: string,
  offerId: string | null,
  draft: PromoOfferDraft
): PromoOfferRow {
  const now = new Date().toISOString();
  const today = todayIsoCasablanca();

  return {
    id: offerId ?? "preview-draft",
    pharmacy_id: pharmacyId,
    title: draft.title.trim() || "Pack sans titre",
    description: draft.description?.trim() || null,
    discount_percent: Math.min(99, Math.max(1, draft.discount_percent || 10)),
    valid_from: draft.valid_from || today,
    valid_until: draft.valid_until || draft.valid_from || today,
    status: "published",
    published_at: now,
    created_at: now,
    updated_at: now,
  };
}

export type PromoOfferPreviewBundle = PromoOfferRow & {
  lines: PromoLineWithPrice[];
};

export function toPublicPromoOfferBundle(
  offer: PromoOfferRow,
  lines: PromoLineWithPrice[]
): PromoOfferPreviewBundle {
  return { ...offer, lines };
}
