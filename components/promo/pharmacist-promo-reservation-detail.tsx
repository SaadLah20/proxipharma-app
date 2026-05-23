"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { MessageCircle } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { fetchPromoOfferLines } from "@/lib/promo/load-offer-lines";
import { markPromoReservationNotificationsRead } from "@/lib/promo/mark-reservation-notifs-read";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { supabase } from "@/lib/supabase";
import { promoReservationBadgeClass, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoReservationStatus } from "@/lib/promo/types";

function whatsAppHref(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function PharmacistPromoReservationDetail({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
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
    offer: { title: string; discount_percent: number } | null;
    patient: { full_name: string | null; whatsapp: string | null } | null;
  } | null>(null);

  const load = useCallback(async () => {
    setError("");
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      setError(ctx.error ?? "Erreur");
      setLoading(false);
      return;
    }
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace(`/auth?redirect=/dashboard/pharmacien/reservations-packs/${reservationId}`);
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pharmacy_promo_reservations")
      .select(
        "id,offer_id,status,pickup_date,pickup_time,patient_note,pharmacist_note,public_ref,pharmacy_promo_offers(title,discount_percent),profiles:patient_id(full_name,whatsapp)"
      )
      .eq("id", reservationId)
      .eq("pharmacy_id", ctx.pharmacyId)
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
        offer: r.pharmacy_promo_offers as { title: string; discount_percent: number } | null,
        patient: r.profiles as { full_name: string | null; whatsapp: string | null } | null,
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

  const runRpc = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError("");
    const { error: rpcErr } = await fn();
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    else {
      setShowDecline(false);
      setDeclineReason("");
      await load();
    }
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
        <Link href="/dashboard/pharmacien/reservations-packs" className="text-xs font-medium text-sky-800 underline">
          ← Réservations packs
        </Link>
        <p className="mt-4 text-sm text-red-800">{error || "Introuvable."}</p>
      </PageShell>
    );
  }

  const pickupLabel = new Date(`${row.pickup_date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const wa = whatsAppHref(row.patient?.whatsapp);

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <div>
        <Link href="/dashboard/pharmacien/reservations-packs" className="text-xs font-medium text-sky-800 underline">
          ← Réservations packs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">{row.offer?.title ?? "Pack promo"}</h1>
            <p className="text-sm text-muted-foreground">{row.patient?.full_name?.trim() || "Patient"}</p>
            {row.patient?.whatsapp ? (
              <p className="text-xs tabular-nums text-muted-foreground">{row.patient.whatsapp}</p>
            ) : null}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline"
              >
                <MessageCircle className="size-3.5" aria-hidden />
                WhatsApp patient
              </a>
            ) : null}
          </div>
          <span
            className={clsx(
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              promoReservationBadgeClass(row.status)
            )}
          >
            {promoReservationLabel(row.status, "pharmacien")}
          </span>
        </div>
        {row.public_ref ? <p className="mt-1 font-mono text-xs">{row.public_ref}</p> : null}
      </div>

      <section className="rounded-xl border bg-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pack réservé</p>
        <div className="mt-2">
          <PromoOfferPackSummary lines={lines} discountPercent={row.offer?.discount_percent ?? 0} compact />
        </div>
      </section>

      <dl className="space-y-2 rounded-xl border p-3 text-sm">
        <div>
          <dt className="text-[10px] font-bold uppercase text-muted-foreground">Passage souhaité</dt>
          <dd>
            {pickupLabel}
            {row.pickup_time ? ` · ${row.pickup_time.slice(0, 5)}` : ""}
          </dd>
        </div>
        {row.patient_note?.trim() ? (
          <div>
            <dt className="text-[10px] font-bold uppercase text-muted-foreground">Message patient</dt>
            <dd>{row.patient_note.trim()}</dd>
          </div>
        ) : null}
        {row.pharmacist_note?.trim() ? (
          <div>
            <dt className="text-[10px] font-bold uppercase text-muted-foreground">Motif / note officine</dt>
            <dd>{row.pharmacist_note.trim()}</dd>
          </div>
        ) : null}
      </dl>

      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      {row.status === "submitted" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            onClick={() =>
              void runRpc(async () =>
                supabase.rpc("pharmacist_confirm_promo_reservation", { p_reservation_id: reservationId })
              )
            }
          >
            Confirmer la réservation
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-900 disabled:opacity-50"
            onClick={() => setShowDecline((v) => !v)}
          >
            Non disponible
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() =>
              void runRpc(async () =>
                supabase.rpc("cancel_promo_reservation", { p_reservation_id: reservationId, p_note: null })
              )
            }
          >
            Annuler
          </button>
        </div>
      ) : null}

      {showDecline && row.status === "submitted" ? (
        <div className="space-y-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
          <label className="block text-xs font-bold">
            Motif (obligatoire)
            <textarea
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Ex. Stock insuffisant pour ce pack"
            />
          </label>
          <button
            type="button"
            disabled={busy || !declineReason.trim()}
            className="rounded-lg bg-rose-800 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() =>
              void runRpc(async () =>
                supabase.rpc("pharmacist_decline_promo_reservation", {
                  p_reservation_id: reservationId,
                  p_reason: declineReason.trim(),
                })
              )
            }
          >
            Envoyer au patient
          </button>
        </div>
      ) : null}

      {row.status === "confirmed" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl bg-violet-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            onClick={() =>
              void runRpc(async () =>
                supabase.rpc("pharmacist_mark_promo_reservation_collected", { p_reservation_id: reservationId })
              )
            }
          >
            Marquer comme récupérée
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() =>
              void runRpc(async () =>
                supabase.rpc("cancel_promo_reservation", { p_reservation_id: reservationId, p_note: null })
              )
            }
          >
            Annuler
          </button>
        </div>
      ) : null}
    </PageShell>
  );
}
