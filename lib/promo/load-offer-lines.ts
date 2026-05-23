import { supabase } from "@/lib/supabase";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";

function mapLineRow(row: Record<string, unknown>): PromoLineWithPrice {
  const prod = row.products as { name?: string; price_pph?: number; photo_url?: string } | null;
  return {
    id: (row.id as string) ?? "",
    offer_id: row.offer_id as string,
    line_kind: row.line_kind as "product" | "gift",
    sort_order: row.sort_order as number,
    product_id: row.product_id as string | null,
    label: row.label as string | null,
    quantity: row.quantity as number,
    product_name: prod?.name ?? (row.label as string | null) ?? null,
    price_pph: prod?.price_pph ?? null,
    photo_url: prod?.photo_url ?? null,
  };
}

/** Lignes d'une ou plusieurs offres, indexées par `offer_id`. */
export async function fetchPromoOfferLinesByOfferIds(
  offerIds: string[]
): Promise<Map<string, PromoLineWithPrice[]>> {
  const map = new Map<string, PromoLineWithPrice[]>();
  if (offerIds.length === 0) return map;

  const { data, error } = await supabase
    .from("pharmacy_promo_offer_lines")
    .select("id,offer_id,line_kind,product_id,label,quantity,sort_order,products(name,price_pph,photo_url)")
    .in("offer_id", offerIds)
    .order("sort_order");

  if (error) return map;

  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const oid = r.offer_id as string;
    const list = map.get(oid) ?? [];
    list.push(mapLineRow(r));
    map.set(oid, list);
  }
  return map;
}

export async function fetchPromoOfferLines(offerId: string): Promise<PromoLineWithPrice[]> {
  const map = await fetchPromoOfferLinesByOfferIds([offerId]);
  return map.get(offerId) ?? [];
}
