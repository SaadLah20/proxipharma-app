"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Package, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PromoReserveModal } from "@/components/promo/promo-reserve-modal";
import { computePromoPackTotals, formatDh, type PromoLineWithPrice } from "@/lib/promo/pricing";
import { formatPromoValidityFr, todayIsoCasablanca } from "@/lib/promo/dates";
import type { PromoOfferRow } from "@/lib/promo/types";

type OfferBundle = PromoOfferRow & {
  lines: PromoLineWithPrice[];
};

export function PublicPromoOffers({ pharmacyId }: { pharmacyId: string }) {
  const [offers, setOffers] = useState<OfferBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<boolean | null>(null);
  const [reserveOffer, setReserveOffer] = useState<OfferBundle | null>(null);
  const [reservedMsg, setReservedMsg] = useState("");

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session?.user)));
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const today = todayIsoCasablanca();
      const { data: off } = await supabase
        .from("pharmacy_promo_offers")
        .select("id,pharmacy_id,title,description,discount_percent,valid_from,valid_until,status,published_at,created_at,updated_at")
        .eq("pharmacy_id", pharmacyId)
        .eq("status", "published")
        .gte("valid_until", today)
        .lte("valid_from", today)
        .order("valid_until");

      const ids = (off ?? []).map((o: { id: string }) => o.id);
      if (ids.length === 0) {
        setOffers([]);
        setLoading(false);
        return;
      }

      const { data: lines } = await supabase
        .from("pharmacy_promo_offer_lines")
        .select("offer_id,line_kind,product_id,label,quantity,sort_order,products(name,price_pph,photo_url)")
        .in("offer_id", ids)
        .order("sort_order");

      const byOffer = new Map<string, PromoLineWithPrice[]>();
      for (const row of lines ?? []) {
        const r = row as Record<string, unknown>;
        const oid = r.offer_id as string;
        const prod = r.products as { name?: string; price_pph?: number; photo_url?: string } | null;
        const list = byOffer.get(oid) ?? [];
        list.push({
          id: "",
          offer_id: oid,
          line_kind: r.line_kind as "product" | "gift",
          sort_order: r.sort_order as number,
          product_id: r.product_id as string | null,
          label: r.label as string | null,
          quantity: r.quantity as number,
          product_name: prod?.name ?? (r.label as string | null) ?? null,
          price_pph: prod?.price_pph ?? null,
        });
        byOffer.set(oid, list);
      }

      setOffers(
        (off ?? []).map((o) => ({
          ...(o as PromoOfferRow),
          lines: byOffer.get((o as { id: string }).id) ?? [],
        }))
      );
      setLoading(false);
    };
    void run();
  }, [pharmacyId]);

  if (loading) return <p className="text-sm text-muted-foreground">Chargement des offres…</p>;
  if (offers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/15 p-6 text-center text-sm text-muted-foreground">
        Aucune offre en cours pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {reservedMsg ? (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-950 ring-1 ring-emerald-200/80">{reservedMsg}</p>
      ) : null}
      {offers.map((o) => {
        const { subtotal, discount, total } = computePromoPackTotals(o.lines, o.discount_percent);
        const products = o.lines.filter((l) => l.line_kind === "product");
        const gifts = o.lines.filter((l) => l.line_kind === "gift");
        return (
          <article key={o.id} className="overflow-hidden rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-card shadow-sm">
            <div className="border-b border-rose-100/80 bg-rose-100/40 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1 text-sm font-bold text-rose-950">
                    <Tag className="size-4" aria-hidden />
                    {o.title}
                  </p>
                  {o.description?.trim() ? (
                    <p className="mt-0.5 text-[11px] text-rose-900/80">{o.description.trim()}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                  −{o.discount_percent} %
                </span>
              </div>
              <p className="mt-1 text-[10px] text-rose-900/70">{formatPromoValidityFr(o.valid_from, o.valid_until)}</p>
            </div>
            <div className="space-y-2 p-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Produits</p>
                <ul className="mt-1 space-y-1">
                  {products.map((l, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <Package className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 font-medium">
                        {l.product_name} × {l.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {gifts.length > 0 ? (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cadeaux</p>
                  <ul className="mt-1 space-y-1">
                    {gifts.map((l, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-amber-900">
                        <Gift className="size-3.5 shrink-0" />
                        {l.product_name ?? l.label}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-[11px]">
                <p className="flex justify-between tabular-nums">
                  <span className="text-muted-foreground">Prix indicatif</span>
                  <span>{formatDh(subtotal)}</span>
                </p>
                <p className="flex justify-between tabular-nums text-emerald-800">
                  <span>Économie</span>
                  <span>−{formatDh(discount)}</span>
                </p>
                <p className="flex justify-between border-t border-border/50 pt-1 text-sm font-bold tabular-nums">
                  <span>Total pack</span>
                  <span>{formatDh(total)}</span>
                </p>
              </div>
              {session === false ? (
                <Link
                  href={`/auth?redirect=/pharmacie/${pharmacyId}`}
                  className="flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground"
                >
                  Se connecter pour réserver
                </Link>
              ) : session === true ? (
                <button
                  type="button"
                  className="w-full rounded-xl bg-rose-700 py-3 text-sm font-bold text-white shadow-sm"
                  onClick={() => setReserveOffer(o)}
                >
                  Réserver ce pack
                </button>
              ) : (
                <div className="h-11 animate-pulse rounded-xl bg-muted" />
              )}
            </div>
          </article>
        );
      })}
      {reserveOffer ? (
        <PromoReserveModal
          open
          offerId={reserveOffer.id}
          offerTitle={reserveOffer.title}
          onClose={() => setReserveOffer(null)}
          onSuccess={() => {
            setReservedMsg(
              "Merci — votre demande a bien été envoyée. L'officine vous confirmera sous peu dans « Mes packs promo »."
            );
            setReserveOffer(null);
          }}
        />
      ) : null}
    </div>
  );
}
