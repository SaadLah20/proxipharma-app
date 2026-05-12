"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { X } from "lucide-react";

const QUICK = "C'est noté";

export type LineConvoVisual = "empty" | "patient_only" | "pharma_only" | "thread";

export function lineConversationVisual(patient: string, pharmacist: string): LineConvoVisual {
  const p = patient.trim();
  const ph = pharmacist.trim();
  if (p && ph) return "thread";
  if (p) return "patient_only";
  if (ph) return "pharma_only";
  return "empty";
}

/** Libellé court pour la pastille / bandeau sous la ligne (4 cas). */
export function lineConversationStripLabel(visual: LineConvoVisual): string {
  switch (visual) {
    case "thread":
      return "Patient + officine";
    case "patient_only":
      return "Message patient";
    case "pharma_only":
      return "Note officine";
    default:
      return "Pas de message";
  }
}

export function lineConversationChipButtonClass(
  visual: LineConvoVisual,
  opts: { open: boolean; disabled?: boolean }
): string {
  const base =
    "relative inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition touch-manipulation active:scale-[0.97]";
  const ring =
    visual === "thread"
      ? "border-violet-400/90 bg-gradient-to-br from-violet-50 via-white to-emerald-50 text-violet-900 shadow-md ring-2 ring-violet-200/80"
      : visual === "patient_only"
        ? "border-sky-400/90 bg-sky-50 text-sky-900 shadow-md ring-2 ring-sky-200/90"
        : visual === "pharma_only"
          ? "border-emerald-400/85 bg-emerald-50 text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
          : "border-slate-200/90 bg-white/95 text-slate-400 shadow-sm ring-1 ring-slate-200/70";
  return clsx(base, ring, opts.open && "ring-offset-2 ring-offset-background", opts.disabled && "opacity-40");
}

/** Bouton bandeau horizontal (icône + texte discret à droite). */
export function lineConversationStripButtonClass(
  visual: LineConvoVisual,
  opts: { open: boolean; disabled?: boolean }
): string {
  const base =
    "relative inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 transition touch-manipulation active:scale-[0.98] sm:gap-2 sm:px-2.5";
  const ring =
    visual === "thread"
      ? "border-violet-300/80 bg-gradient-to-r from-violet-50/90 to-emerald-50/50 text-violet-900 shadow-sm ring-1 ring-violet-200/60"
      : visual === "patient_only"
        ? "border-sky-300/85 bg-sky-50/90 text-sky-950 shadow-sm ring-1 ring-sky-200/70"
        : visual === "pharma_only"
          ? "border-emerald-300/80 bg-emerald-50/85 text-emerald-950 shadow-sm ring-1 ring-emerald-200/65"
          : "border-border/70 bg-muted/25 text-muted-foreground shadow-sm ring-1 ring-border/40";
  return clsx(base, ring, opts.open && "ring-2 ring-offset-1 ring-offset-background", opts.disabled && "pointer-events-none opacity-40");
}

type ModalProps = {
  lineId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientText: string;
  pharmacistDraft: string;
  onPharmacistDraftChange: (v: string) => void;
  allowEdit: boolean;
  showPersistButton: boolean;
  onPersist?: () => void | Promise<void>;
  persistBusy: boolean;
};

/** Modal plein écran (centré) — évite l’ancrage DOM fragile et toute navigation involontaire. */
export function PharmacistLineConversationModal({
  lineId,
  open,
  onOpenChange,
  patientText,
  pharmacistDraft,
  onPharmacistDraftChange,
  allowEdit,
  showPersistButton,
  onPersist,
  persistBusy,
}: ModalProps) {
  const uid = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = `line-convo-${uid}-${lineId}`;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10055] flex items-end justify-center overflow-y-auto overscroll-y-contain bg-black/45 p-3 backdrop-blur-[1px] sm:items-center"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !persistBusy) onOpenChange(false);
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[min(88vh,32rem)] w-full max-w-md touch-manipulation flex-col overflow-hidden rounded-2xl border border-border/90 bg-card py-2.5 shadow-2xl ring-1 ring-black/10"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 pb-2">
          <div className="min-w-0">
            <p id={titleId} className="text-[11px] font-bold text-foreground">
              Échange sur la ligne
            </p>
            <p className="mt-0.5 text-[9px] text-muted-foreground">
              {allowEdit || showPersistButton
                ? "Visible par le patient avec votre réponse."
                : "Lecture seule sur ce dossier."}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-transparent p-1 text-muted-foreground hover:bg-muted/60 disabled:opacity-40"
            aria-label="Fermer"
            disabled={persistBusy}
            onClick={() => onOpenChange(false)}
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-2 [-webkit-overflow-scrolling:touch]">
          {patientText.trim() ? (
            <div className="rounded-xl border border-sky-200/80 bg-sky-50/90 px-2.5 py-2 shadow-sm">
              <p className="text-[9px] font-bold uppercase tracking-wide text-sky-900/90">Patient</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-sky-950">{patientText.trim()}</p>
            </div>
          ) : (
            <p className="text-[10px] italic text-muted-foreground">Aucun commentaire patient sur ce produit.</p>
          )}

          {allowEdit || showPersistButton ? (
            <div className="mt-3 space-y-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900/90">
                {patientText.trim() ? "Votre réponse" : "Note officine (optionnel)"}
              </p>
              <textarea
                rows={4}
                value={pharmacistDraft}
                onChange={(e) => onPharmacistDraftChange(e.target.value.slice(0, 1000))}
                placeholder={patientText.trim() ? "Réponse au client…" : "Message visible avec votre réponse…"}
                disabled={!allowEdit && !showPersistButton}
                className="min-h-[5.5rem] w-full resize-y rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-2.5 py-2 text-[12px] leading-snug text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/35 disabled:opacity-60"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-emerald-300/80 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-emerald-950 shadow-sm hover:bg-emerald-50 disabled:opacity-50"
                  disabled={!allowEdit && !showPersistButton}
                  onClick={() => onPharmacistDraftChange(QUICK)}
                >
                  « {QUICK} »
                </button>
              </div>
            </div>
          ) : pharmacistDraft.trim() ? (
            <div className="mt-3 rounded-xl border border-emerald-200/75 bg-emerald-50/70 px-2.5 py-2">
              <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-900/90">Officine</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-emerald-950">{pharmacistDraft.trim()}</p>
            </div>
          ) : (
            <p className="mt-3 text-[10px] italic text-muted-foreground">Aucune note officine.</p>
          )}
        </div>

        {showPersistButton && onPersist ? (
          <div className="shrink-0 border-t border-border/60 px-3 pt-2">
            <button
              type="button"
              disabled={persistBusy}
              onClick={() => void onPersist()}
              className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-emerald-700 px-3 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              {persistBusy ? "Enregistrement…" : "Enregistrer la réponse"}
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
