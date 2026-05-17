"use client";

import { useState } from "react";
import { requestStatusFr } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";

type PatientPrescriptionRequestPanelProps = {
  requestId: string;
  status: string;
  paths: PrescriptionPagePaths;
  patientNote: string | null;
  onReload: () => Promise<void>;
};

export function PatientPrescriptionRequestPanel({
  requestId,
  status,
  paths,
  patientNote,
  onReload,
}: PatientPrescriptionRequestPanelProps) {
  const [exitOpen, setExitOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canCancel = status === "submitted" || status === "in_review";

  const handleCancel = async (p: { kind: "patient"; code: PatientCancelReasonCode; other: string | null }) => {
    setError("");
    setBusy(true);
    try {
      const { error: rpcErr } = await supabase.rpc("patient_cancel_product_request_before_response", {
        p_request_id: requestId,
        p_reason_code: p.code,
        p_reason_other: p.other,
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setExitOpen(false);
      await onReload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-3 py-2.5 text-sm text-amber-950">
        <p className="font-semibold">{requestStatusFr[status] ?? status}</p>
        <p className="mt-1 text-xs leading-snug text-amber-900/90">
          La pharmacie lit votre ordonnance et saisira les produits. Vous serez notifié dès que la réponse sera publiée.
        </p>
      </div>

      <PrescriptionImageViewer paths={paths} accent="amber" />

      {patientNote?.trim() ? (
        <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Votre message</p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{patientNote.trim()}</p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{error}</p>
      ) : null}

      {canCancel ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => setExitOpen(true)}
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50 disabled:opacity-50"
          >
            Annuler l’ordonnance
          </button>
          <RequestExitConfirmModalFr
            open={exitOpen}
            mode="patient_before_response"
            busy={busy}
            onClose={() => setExitOpen(false)}
            onConfirmPatient={(p) => void handleCancel(p)}
          />
        </>
      ) : null}
    </section>
  );
}
