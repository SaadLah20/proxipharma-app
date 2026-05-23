"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PromoReserveModal } from "@/components/promo/promo-reserve-modal";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { fetchPromoOfferLinesByOfferIds } from "@/lib/promo/load-offer-lines";
import { formatPromoValidityFr, todayIsoCasablanca } from "@/lib/promo/dates";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoOfferRow } from "@/lib/promo/types";

type OfferBundle = PromoOfferRow & {
  lines: PromoLineWithPrice[];
};

type ActiveReservation = { offer_id: string; id: string };

export function PublicPromoOffers({ pharmacyId }: { pharmacyId: string }) {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferBundle[]>([]);
  const [activeByOffer, setActiveByOffer] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<boolean | null>(null);
  const [reserveOffer, setReserveOffer] = useState<OfferBundle | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const today = todayIsoCasablanca();
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user?.id ?? null;
    setSession(Boolean(userId));

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
      setActiveByOffer(new Map());
      setLoading(false);
      return;
    }

    const linesMap = await fetchPromoOfferLinesByOfferIds(ids);

    if (userId) {
      const { data: active } = await supabase
        .from("pharmacy_promo_reservations")
        .select("id,offer_id")
        .eq("patient_id", userId)
        .in("offer_id", ids)
        .in("status", ["submitted", "confirmed"]);
      const m = new Map<string, string>();
      for (const r of (active ?? []) as ActiveReservation[]) {
        m.set(r.offer_id, r.id);
      }
      setActiveByOffer(m);
    } else {
      setActiveByOffer(new Map());
    }

    setOffers(
      (off ?? []).map((o) => ({
        ...(o as PromoOfferRow),
        lines: linesMap.get((o as { id: string }).id) ?? [],
      }))
    );
    setLoading(false);
  }, [pharmacyId]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted/40" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-muted/15 p-6 text-center text-sm text-muted-foreground">
        Aucune offre en cours pour le moment.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {offers.map((o) => {
        const existingId = activeByOffer.get(o.id);
        return (
          <article
            key={o.id}
            className="overflow-hidden rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/80 to-card shadow-sm"
          >
            <div className="border-b border-rose-100/80 bg-rose-100/40 px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-rose-950">
                    <Tag className="size-4 shrink-0" aria-hidden />
                    {o.title}
                  </p>
                  {o.description?.trim() ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-rose-900/80">{o.description.trim()}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  −{o.discount_percent} %
                </span>
              </div>
              <p className="mt-1 text-[10px] text-rose-900/70">{formatPromoValidityFr(o.valid_from, o.valid_until)}</p>
            </div>
            <div className="space-y-3 p-3">
              <PromoOfferPackSummary lines={o.lines} discountPercent={o.discount_percent} compact />
              {session === false ? (
                <Link
                  href={`/auth?redirect=/pharmacie/${pharmacyId}`}
                  className="flex w-full items-center justify-center rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm"
                >
                  Se connecter pour réserver
                </Link>
              ) : session === true ? (
                existingId ? (
                  <Link
                    href={`/dashboard/patient/packs-promo/${existingId}`}
                    className="flex w-full items-center justify-center rounded-xl border-2 border-emerald-600 bg-emerald-50 py-3 text-sm font-bold text-emerald-900"
                  >
                    Voir ma réservation en cours
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-rose-700 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-rose-800"
                    onClick={() => setReserveOffer(o)}
                  >
                    Réserver ce pack
                  </button>
                )
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
          onSuccess={(reservationId) => {
            setReserveOffer(null);
            router.push(`/dashboard/patient/packs-promo/${reservationId}`);
          }}
        />
      ) : null}
    </div>
  );
}
