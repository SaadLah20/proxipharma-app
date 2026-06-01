"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { todayIsoCasablanca, maxPickupDateIso } from "@/lib/promo/dates";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";

/** Formulaire monté/démonté avec la modale — état initial sans useEffect (ESLint set-state-in-effect). */
function PromoReserveForm({
  offerId,
  offerTitle,
  onClose,
  onSuccess,
}: {
  offerId: string;
  offerTitle: string;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
}) {
  const today = todayIsoCasablanca();
  const maxDate = maxPickupDateIso(today);
  const [pickupDate, setPickupDate] = useState(today);
  const [pickupTime, setPickupTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("patient_submit_promo_reservation", {
      p_offer_id: offerId,
      p_pickup_date: pickupDate,
      p_pickup_time: pickupTime.trim() ? pickupTime : null,
      p_patient_note: note.trim() || null,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    onSuccess(data as string);
  };

  return (
    <div
      className="w-full max-w-md rounded-2xl border bg-card p-4 shadow-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-reserve-title"
    >
      <h2 id="promo-reserve-title" className="text-base font-bold">
        Réserver ce pack
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{offerTitle}</p>
      <p className="mt-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[11px] leading-snug text-sky-950 ring-1 ring-sky-100">
        Choisissez votre date de passage (aujourd&apos;hui → 3 jours max). L&apos;officine confirmera la
        disponibilité du pack.
      </p>
      <label className="mt-3 block text-xs font-bold">
        Date de passage *
        <input
          type="date"
          min={today}
          max={maxDate}
          className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
          value={pickupDate}
          onChange={(e) => setPickupDate(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs font-bold">
        Heure souhaitée (facultatif)
        <input
          type="time"
          className="mt-1 h-11 w-full rounded-lg border px-2 text-sm"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
        />
      </label>
      <label className="mt-2 block text-xs font-bold">
        Message (facultatif)
        <textarea
          className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
          rows={2}
          maxLength={300}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex. Je passerai en fin de matinée"
        />
      </label>
      {error ? <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-sm text-red-800">{error}</p> : null}
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
          onClick={onClose}
          disabled={busy}
        >
          Annuler
        </button>
        <button
          type="button"
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
          disabled={busy || !pickupDate}
          onClick={() => void submit()}
        >
          {busy ? "Envoi…" : "Envoyer ma demande"}
        </button>
      </div>
    </div>
  );
}

export function PromoReserveModal({
  open,
  offerTitle,
  offerId,
  onClose,
  onSuccess,
}: {
  open: boolean;
  offerTitle: string;
  offerId: string;
  onClose: () => void;
  onSuccess: (reservationId: string) => void;
}) {
  return (
    <AppModalOverlay
      open={open}
      onBackdropClick={onClose}
    >
      <PromoReserveForm
        key={offerId}
        offerId={offerId}
        offerTitle={offerTitle}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </AppModalOverlay>
  );
}
