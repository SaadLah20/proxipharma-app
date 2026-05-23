"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { PageShell } from "@/components/ui/compact-shell";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { fetchPromoOfferLines } from "@/lib/promo/load-offer-lines";
import { markPromoReservationNotificationsRead } from "@/lib/promo/mark-reservation-notifs-read";
import { supabase } from "@/lib/supabase";
import { promoReservationBadgeClass, promoReservationHint, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoReservationStatus } from "@/lib/promo/types";

export function PatientPromoReservationDetail({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<PromoLineWithPrice[]>([]);
  const [row, setRow] = useState<{
    id: string;
    offer_id: string;
    status: PromoReservationStatus;
    pickup_date: string;
    pickup_time: string | null;
    patient_note: string | null;
    pharmacist_note: string | null;
    public_ref: string | null;
    offer: { title: string; discount_percent: number; description: string | null } | null;
    pharmacy: { nom: string; id: string } | null;
  } | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace(`/auth?redirect=/dashboard/patient/packs-promo/${reservationId}`);
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pharmacy_promo_reservations")
      .select(
        "id,offer_id,status,pickup_date,pickup_time,patient_note,pharmacist_note,public_ref,pharmacy_promo_offers(title,description,discount_percent),pharmacies:pharmacy_id(id,nom)"
      )
      .eq("id", reservationId)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message ?? "Réservation introuvable.");
      setRow(null);
      setLines([]);
    } else {
      const r = data as Record<string, unknown>;
      const offerId = r.offer_id as string;
      setRow({
        id: r.id as string,
        offer_id: offerId,
        status: r.status as PromoReservationStatus,
        pickup_date: r.pickup_date as string,
        pickup_time: r.pickup_time as string | null,
        patient_note: r.patient_note as string | null,
        pharmacist_note: r.pharmacist_note as string | null,
        public_ref: r.public_ref as string | null,
        offer: r.pharmacy_promo_offers as {
          title: string;
          discount_percent: number;
          description: string | null;
        } | null,
        pharmacy: r.pharmacies as { nom: string; id: string } | null,
      });
      setLines(await fetchPromoOfferLines(offerId));
      void markPromoReservationNotificationsRead(reservationId);
    }
    setLoading(false);
  }, [reservationId, router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const cancel = async () => {
    if (!row || !["submitted", "confirmed"].includes(row.status)) return;
    if (!window.confirm("Annuler cette réservation ?")) return;
    setBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("cancel_promo_reservation", {
      p_reservation_id: reservationId,
      p_note: null,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    else await load();
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (!row) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <Link href="/dashboard/patient/packs-promo" className="text-xs font-medium text-sky-800 underline">
          ← Mes packs promo
        </Link>
        <p className="mt-4 text-sm text-red-800">{error || "Introuvable."}</p>
      </PageShell>
    );
  }

  const pickupLabel = new Date(`${row.pickup_date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <div>
        <Link href="/dashboard/patient/packs-promo" className="text-xs font-medium text-sky-800 underline">
          ← Mes packs promo
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">{row.offer?.title ?? "Pack promo"}</h1>
            <p className="text-xs text-muted-foreground">{row.pharmacy?.nom}</p>
          </div>
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              promoReservationBadgeClass(row.status)
            )}
          >
            {promoReservationLabel(row.status, "patient")}
          </span>
        </div>
        {row.public_ref ? <p className="mt-1 font-mono text-xs text-muted-foreground">{row.public_ref}</p> : null}
      </div>

      <p className="rounded-xl bg-sky-50/80 px-3 py-2.5 text-sm leading-snug text-sky-950 ring-1 ring-sky-100">
        {promoReservationHint(row.status, {
          pharmacistMessage: Boolean(row.pharmacist_note?.trim()),
        })}
      </p>

      {["unavailable", "cancelled", "confirmed"].includes(row.status) && row.pharmacist_note?.trim() ? (
        <div
          className={clsx(
            "rounded-xl border px-3 py-2.5 text-sm",
            row.status === "confirmed"
              ? "border-emerald-200 bg-emerald-50/60 text-emerald-950"
              : "border-rose-200 bg-rose-50/50 text-rose-950"
          )}
        >
          <p className="text-[10px] font-bold uppercase">Message de l&apos;officine</p>
          <p className="mt-1 leading-snug">{row.pharmacist_note.trim()}</p>
        </div>
      ) : null}

      <section className="rounded-xl border-2 border-slate-200/90 bg-card p-4 shadow-sm">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Contenu du pack</p>
        <div className="mt-3">
          <PromoOfferPackSummary
            lines={lines}
            discountPercent={row.offer?.discount_percent ?? 0}
            variant="detail"
          />
        </div>
      </section>

      <dl className="space-y-2 rounded-xl border p-3 text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted-foreground">Date de passage</dt>
          <dd>
            {pickupLabel}
            {row.pickup_time ? ` · ${row.pickup_time.slice(0, 5)}` : ""}
          </dd>
        </div>
        {row.patient_note?.trim() ? (
          <div>
            <dt className="text-[10px] font-bold uppercase text-muted-foreground">Votre message</dt>
            <dd className="text-muted-foreground">{row.patient_note.trim()}</dd>
          </div>
        ) : null}
      </dl>

      {row.pharmacy?.id ? (
        <Link
          href={`/pharmacie/${row.pharmacy.id}`}
          className="inline-block text-xs font-semibold text-sky-800 underline"
        >
          Voir la fiche pharmacie
        </Link>
      ) : null}

      {error ? <p className="text-sm text-red-800">{error}</p> : null}

      {["submitted", "confirmed"].includes(row.status) ? (
        <button
          type="button"
          disabled={busy}
          className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-800 disabled:opacity-50 sm:w-auto"
          onClick={() => void cancel()}
        >
          {busy ? "Annulation…" : "Annuler ma réservation"}
        </button>
      ) : null}
    </PageShell>
  );
}
