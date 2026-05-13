"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  PATIENT_CANCEL_REASON_CODES,
  PATIENT_CANCEL_REASON_LABELS,
  type PatientCancelReasonCode,
} from "@/lib/patient-flow-reasons";

export type RequestExitModalMode = "patient_before_response" | "patient_abandon" | "pharmacist_cancel";

type PatientPayload = { kind: "patient"; code: PatientCancelReasonCode; other: string | null };
type PharmacistPayload = { kind: "pharmacist"; motif: string };

export function RequestExitConfirmModalFr({
  open,
  mode,
  onClose,
  busy,
  onConfirmPatient,
  onConfirmPharmacist,
}: {
  open: boolean;
  mode: RequestExitModalMode;
  onClose: () => void;
  busy: boolean;
  onConfirmPatient?: (p: PatientPayload) => void | Promise<void>;
  onConfirmPharmacist?: (p: PharmacistPayload) => void | Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState<PatientCancelReasonCode>("no_longer_needed");
  const [detail, setDetail] = useState("");
  const [pharmaMotif, setPharmaMotif] = useState("");

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const isPatient = mode === "patient_before_response" || mode === "patient_abandon";
  const isBefore = mode === "patient_before_response";

  const step1Title = isBefore
    ? "Annuler la demande"
    : isPatient
      ? "Abandonner la demande"
      : "Annuler la demande côté pharmacie";

  const step1Intro = isBefore
    ? "La pharmacie n’a pas encore publié de réponse. Indiquez un motif — l’officine verra que la demande ne vous intéresse plus."
    : isPatient
      ? "Vous avez déjà une réponse ou une commande en cours sur ce dossier. Expliquez pourquoi vous souhaitez l’abandonner."
      : "Motif obligatoire (visible pour le patient dans son suivi). Cette action est définitive.";

  const otherOk = code !== "other" || detail.trim().length >= 8;
  const pharmaOk = pharmaMotif.trim().length >= 5;

  const goStep2 = () => {
    if (isPatient) {
      if (!otherOk) return;
    } else {
      if (!pharmaOk) return;
    }
    setStep(2);
  };

  const finalPatient = async () => {
    const other = detail.trim();
    await onConfirmPatient?.({
      kind: "patient",
      code,
      other: code === "other" ? other : null,
    });
  };

  const finalPharmacist = async () => {
    await onConfirmPharmacist?.({ kind: "pharmacist", motif: pharmaMotif.trim() });
  };

  const warningBlock = (
    <div className="rounded-lg border border-amber-300/80 bg-amber-50/90 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
      <p className="font-semibold">Attention — décision définitive</p>
      <p className="mt-1">
        {isPatient ? (
          <>
            Vous ne pourrez pas réactiver cette demande. La pharmacie ne pourra plus la traiter comme un dossier ouvert
            (historique conservé).
          </>
        ) : (
          <>
            Le patient sera informé et ne pourra pas rouvrir ce dossier. Votre officine ne pourra plus le traiter non
            plus.
          </>
        )}
      </p>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[10080] flex items-end justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer" disabled={busy} onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(92dvh,32rem)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[min(90dvh,32rem)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              {step === 1 ? "Étape 1 sur 2" : "Confirmation finale"}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-tight text-foreground">{step === 1 ? step1Title : "Confirmer ?"}</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {step === 1 ? (
            <div className="space-y-3">
              <p className="text-[11px] leading-snug text-muted-foreground">{step1Intro}</p>
              {isPatient ? (
                <>
                  <label className="block text-[11px] font-medium text-foreground">
                    Motif
                    <select
                      value={code}
                      disabled={busy}
                      onChange={(e) => setCode(e.target.value as PatientCancelReasonCode)}
                      className="mt-1 block w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
                    >
                      {PATIENT_CANCEL_REASON_CODES.map((c) => (
                        <option key={c} value={c}>
                          {PATIENT_CANCEL_REASON_LABELS[c]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {code === "other" ? (
                    <label className="block text-[11px] font-medium text-foreground">
                      Précision (au moins 8 caractères)
                      <textarea
                        value={detail}
                        disabled={busy}
                        rows={3}
                        onChange={(e) => setDetail(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
                        placeholder="Expliquez brièvement…"
                      />
                    </label>
                  ) : null}
                </>
              ) : (
                <label className="block text-[11px] font-medium text-foreground">
                  Motif (au moins 5 caractères)
                  <textarea
                    value={pharmaMotif}
                    disabled={busy}
                    rows={4}
                    onChange={(e) => setPharmaMotif(e.target.value.slice(0, 1000))}
                    className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-2 text-xs"
                    placeholder="Exemple : doublon, erreur de saisie, rupture prolongée…"
                  />
                </label>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={onClose}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted/60"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={busy || (isPatient ? !otherOk : !pharmaOk)}
                  onClick={() => goStep2()}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-45"
                >
                  Continuer
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {warningBlock}
              {isPatient ? (
                <p className="text-[11px] leading-snug text-foreground">
                  <span className="font-medium">Motif retenu :</span>{" "}
                  {code === "other" ? detail.trim() || "—" : PATIENT_CANCEL_REASON_LABELS[code]}
                </p>
              ) : (
                <p className="text-[11px] leading-snug text-foreground">
                  <span className="font-medium">Motif :</span> {pharmaMotif.trim()}
                </p>
              )}
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted/60"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void (isPatient ? finalPatient() : finalPharmacist())}
                  className="rounded-lg border border-destructive/50 bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-45"
                >
                  {busy ? "En cours…" : isBefore ? "Confirmer l’annulation" : isPatient ? "Confirmer l’abandon" : "Confirmer l’annulation officine"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
