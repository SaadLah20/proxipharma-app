"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { PageShell } from "@/components/ui/compact-shell";
import { DossierInlineActionPanel } from "@/components/requests/dossier-inline-action-panel";
import { PharmacistPromoReservationDossierHeader } from "@/components/promo/pharmacist-promo-reservation-dossier-header";
import { PromoReservationHistoryPanel } from "@/components/promo/promo-reservation-history-panel";
import { PromoOfferDescriptionPanel } from "@/components/promo/promo-offer-description-panel";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { pharmacistPromoReservationDossierSectionShellClass } from "@/lib/pharmacist-promo-reservation-line-ui";
import { fetchPromoOfferLines } from "@/lib/promo/load-offer-lines";
import { loadPharmacistPromoPatientContact } from "@/lib/promo/load-pharmacist-promo-patient-contacts";
import { markPromoReservationNotificationsRead } from "@/lib/promo/mark-reservation-notifs-read";
import type { PromoReservationHistoryRow } from "@/lib/promo/promo-reservation-history-labels";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoReservationStatus } from "@/lib/promo/types";

function PharmacistNoteForm({
  label,
  placeholder,
  value,
  onChange,
  required,
  submitLabel,
  busy,
  disabled,
  onSubmit,
  onCancel,
  tone = "default",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  submitLabel: string;
  busy: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={clsx(
        "space-y-2 rounded-xl border p-3",
        tone === "danger" ? "border-rose-200 bg-rose-50/50" : "border-emerald-200/80 bg-emerald-50/30",
      )}
    >
      <label className="block text-xs font-bold text-foreground">
        {label}
        {required ? <span className="text-rose-700"> *</span> : null}
        <textarea
          className="mt-1 w-full rounded-lg border border-input bg-white px-2.5 py-2 text-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={500}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50"
            onClick={onCancel}
          >
            Retour
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy || disabled || (required && !value.trim())}
          className={clsx(
            "rounded-lg px-3 py-2 text-xs font-bold text-white disabled:opacity-50",
            tone === "danger" ? "bg-rose-800 hover:bg-rose-900" : "bg-emerald-700 hover:bg-emerald-800",
          )}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

export function PharmacistPromoReservationDetail({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [error, setError] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [panel, setPanel] = useState<"none" | "decline" | "cancel">("none");
  const [lines, setLines] = useState<PromoLineWithPrice[]>([]);
  const [historyRows, setHistoryRows] = useState<PromoReservationHistoryRow[]>([]);
  const [row, setRow] = useState<{
    id: string;
    offer_id: string;
    patient_id: string;
    status: PromoReservationStatus;
    pickup_date: string;
    pickup_time: string | null;
    patient_note: string | null;
    pharmacist_note: string | null;
    public_ref: string | null;
    created_at: string;
    offer: { title: string; discount_percent: number; description: string | null } | null;
    patient: {
      full_name: string | null;
      whatsapp: string | null;
      email: string | null;
      patient_ref: string | null;
    } | null;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryBusy(true);
    const { data } = await supabase
      .from("pharmacy_promo_reservation_status_history")
      .select("id,old_status,new_status,note,created_at")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });
    setHistoryRows((data ?? []) as PromoReservationHistoryRow[]);
    setHistoryBusy(false);
  }, [reservationId]);

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
        "id,offer_id,patient_id,status,pickup_date,pickup_time,patient_note,pharmacist_note,public_ref,created_at,pharmacy_promo_offers(title,description,discount_percent)",
      )
      .eq("id", reservationId)
      .eq("pharmacy_id", ctx.pharmacyId)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message ?? "Réservation introuvable.");
      setRow(null);
      setLines([]);
      setHistoryRows([]);
    } else {
      const r = data as Record<string, unknown>;
      const offerId = r.offer_id as string;
      const patientId = r.patient_id as string;
      const patientContact = await loadPharmacistPromoPatientContact(patientId);
      setRow({
        id: r.id as string,
        offer_id: offerId,
        patient_id: patientId,
        status: r.status as PromoReservationStatus,
        pickup_date: r.pickup_date as string,
        pickup_time: r.pickup_time as string | null,
        patient_note: r.patient_note as string | null,
        pharmacist_note: r.pharmacist_note as string | null,
        public_ref: r.public_ref as string | null,
        created_at: r.created_at as string,
        offer: r.pharmacy_promo_offers as { title: string; discount_percent: number; description: string | null } | null,
        patient: patientContact,
      });
      setLines(await fetchPromoOfferLines(offerId));
      void markPromoReservationNotificationsRead(reservationId);
      await loadHistory();
    }
    setLoading(false);
  }, [reservationId, router, loadHistory]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const resetPanels = () => {
    setPanel("none");
    setDeclineReason("");
    setCancelReason("");
  };

  const runRpc = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    setError("");
    const { error: rpcErr } = await fn();
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    else {
      resetPanels();
      setConfirmMessage("");
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
        <Link href="/dashboard/pharmacien/reservations-packs" className={p.backLink}>
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
  const canAct = row.status === "submitted" || row.status === "confirmed";
  const dossierRefLabel = row.public_ref?.trim() || row.id.slice(0, 8);

  const actionBlock =
    row.status === "submitted" && panel === "none" ? (
      <div className="space-y-3">
        <PharmacistNoteForm
          label="Réponse / message au patient (avec la confirmation)"
          placeholder={
            row.patient_note?.trim()
              ? "Ex. Bonjour, votre pack est prêt pour le créneau choisi…"
              : "Message facultatif transmis au patient avec la confirmation"
          }
          value={confirmMessage}
          onChange={setConfirmMessage}
          submitLabel="Confirmer la réservation"
          busy={busy}
          onSubmit={() =>
            void runRpc(async () =>
              supabase.rpc("pharmacist_confirm_promo_reservation", {
                p_reservation_id: reservationId,
                p_pharmacist_note: confirmMessage.trim() || null,
              }),
            )
          }
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-900 disabled:opacity-50"
            onClick={() => setPanel("decline")}
          >
            Non disponible
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            onClick={() => setPanel("cancel")}
          >
            Annuler la réservation
          </button>
        </div>
      </div>
    ) : row.status === "submitted" && panel === "decline" ? (
      <PharmacistNoteForm
        label="Motif visible par le patient"
        placeholder="Ex. Stock insuffisant pour ce pack"
        value={declineReason}
        onChange={setDeclineReason}
        required
        submitLabel="Envoyer au patient"
        busy={busy}
        tone="danger"
        onCancel={() => setPanel("none")}
        onSubmit={() =>
          void runRpc(async () =>
            supabase.rpc("pharmacist_decline_promo_reservation", {
              p_reservation_id: reservationId,
              p_reason: declineReason.trim(),
            }),
          )
        }
      />
    ) : canAct && panel === "cancel" ? (
      <PharmacistNoteForm
        label="Motif d'annulation (visible par le patient)"
        placeholder="Ex. Erreur de stock, report impossible…"
        value={cancelReason}
        onChange={setCancelReason}
        required
        submitLabel="Confirmer l'annulation"
        busy={busy}
        tone="danger"
        onCancel={() => setPanel("none")}
        onSubmit={() =>
          void runRpc(async () =>
            supabase.rpc("cancel_promo_reservation", {
              p_reservation_id: reservationId,
              p_note: cancelReason.trim(),
            }),
          )
        }
      />
    ) : row.status === "confirmed" && panel === "none" ? (
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={busy}
          className="rounded-xl bg-violet-800 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          onClick={() =>
            void runRpc(async () =>
              supabase.rpc("pharmacist_mark_promo_reservation_collected", { p_reservation_id: reservationId }),
            )
          }
        >
          Marquer comme récupérée
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-xl border px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
          onClick={() => setPanel("cancel")}
        >
          Annuler la réservation
        </button>
      </div>
    ) : null;

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-3 bg-slate-50">
      <Link href="/dashboard/pharmacien/reservations-packs" className={p.backLink}>
        ← Réservations packs
      </Link>

      <section
        className={clsx(
          "min-w-0 w-full max-w-full space-y-3 overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
          pharmacistPromoReservationDossierSectionShellClass,
        )}
      >
        <PharmacistPromoReservationDossierHeader
          dossierRefLabel={dossierRefLabel}
          offerTitle={row.offer?.title ?? "Pack promo"}
          status={row.status}
          reservedAt={row.created_at}
          createdAt={row.created_at}
          patientId={row.patient_id}
          patientContact={row.patient}
        />

        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Contenu du pack réservé
          </p>
          {row.offer?.title ? (
            <p className="mt-1 text-sm font-semibold leading-snug text-foreground">{row.offer.title}</p>
          ) : null}
          <PromoOfferDescriptionPanel className="mt-2" description={row.offer?.description} />
          <div className="mt-3">
            <PromoOfferPackSummary
              lines={lines}
              discountPercent={row.offer?.discount_percent ?? 0}
              variant="detail"
            />
          </div>
        </section>

        <dl className="space-y-2 rounded-xl border border-border/80 bg-card p-3 text-sm">
          <div>
            <dt className="text-[10px] font-bold uppercase text-muted-foreground">Passage souhaité</dt>
            <dd>
              {pickupLabel}
              {row.pickup_time ? ` · ${row.pickup_time.slice(0, 5)}` : ""}
            </dd>
          </div>
        </dl>

        {row.patient_note?.trim() ? (
          <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase text-sky-900">Message du patient</p>
            <p className="mt-1 text-sm leading-snug text-sky-950">{row.patient_note.trim()}</p>
          </div>
        ) : null}

        {!canAct && row.pharmacist_note?.trim() ? (
          <div className="rounded-xl border bg-muted/20 px-3 py-2.5 text-sm">
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Votre message au patient</p>
            <p className="mt-1">{row.pharmacist_note.trim()}</p>
          </div>
        ) : null}

        {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

        {panel !== "none" ? <div className="pt-1">{actionBlock}</div> : null}
      </section>

      {canAct && panel === "none" ? (
        <DossierInlineActionPanel tone="emerald">{actionBlock}</DossierInlineActionPanel>
      ) : null}

      <PromoReservationHistoryPanel
        rows={historyRows}
        role="pharmacien"
        busy={historyBusy}
        onRefresh={() => void loadHistory()}
      />
    </PageShell>
  );
}
