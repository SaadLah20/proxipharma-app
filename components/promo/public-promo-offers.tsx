"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicPromoOfferCard } from "@/components/promo/public-promo-offer-card";
import {
  PharmacyPublicEmptyState,
  PharmacyPublicSectionTitle,
  pharmacyPublicCard,
} from "@/components/pharmacy/pharmacy-public-chrome";
import { PromoReserveModal } from "@/components/promo/promo-reserve-modal";
import { fetchPromoOfferLinesByOfferIds } from "@/lib/promo/load-offer-lines";
import { todayIsoCasablanca } from "@/lib/promo/dates";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoOfferRow } from "@/lib/promo/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const collapsible = offers.length > 1;
  const singleOfferExpanded = offers.length === 1;

  useEffect(() => {
    let cancelled = false;

    async function loadOffers() {
      setLoading(true);
      const today = todayIsoCasablanca();
      const { data: auth } = await supabase.auth.getSession();
      const userId = auth.session?.user?.id ?? null;
      if (!cancelled) setSession(Boolean(userId));

      const { data: off } = await supabase
        .from("pharmacy_promo_offers")
        .select("id,pharmacy_id,title,description,discount_percent,valid_from,valid_until,status,published_at,created_at,updated_at")
        .eq("pharmacy_id", pharmacyId)
        .eq("status", "published")
        .gte("valid_until", today)
        .lte("valid_from", today)
        .order("valid_until");

      const ids = (off ?? []).map((o: { id: string }) => o.id);
      if (cancelled) return;

      if (ids.length === 0) {
        setOffers([]);
        setActiveByOffer(new Map());
        setLoading(false);
        return;
      }

      const linesMap = await fetchPromoOfferLinesByOfferIds(ids);
      if (cancelled) return;

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
    }

    const tid = window.setTimeout(() => void loadOffers(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [pharmacyId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <PharmacyPublicSectionTitle title="Offres promotionnelles" hint="Chargement des packs…" />
        {[1, 2].map((i) => (
          <div key={i} className={cn(pharmacyPublicCard, "h-36 animate-pulse bg-muted/30")} />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="space-y-3">
        <PharmacyPublicSectionTitle
          title="Offres promotionnelles"
          hint="Packs à prix réduit proposés par l'officine."
        />
        <PharmacyPublicEmptyState>Aucune offre en cours pour le moment.</PharmacyPublicEmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PharmacyPublicSectionTitle
        title="Offres promotionnelles"
        hint={`${offers.length} pack${offers.length > 1 ? "s" : ""} en cours`}
      />
      {offers.map((o) => {
        const expanded = singleOfferExpanded || expandedIds.has(o.id);
        return (
          <PublicPromoOfferCard
            key={o.id}
            offer={o}
            pharmacyId={pharmacyId}
            session={session}
            existingReservationId={activeByOffer.get(o.id)}
            expanded={expanded}
            collapsible={collapsible}
            onToggle={() => {
              setExpandedIds((prev) => {
                const next = new Set(prev);
                if (next.has(o.id)) next.delete(o.id);
                else next.add(o.id);
                return next;
              });
            }}
            onReserve={() => setReserveOffer(o)}
          />
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
