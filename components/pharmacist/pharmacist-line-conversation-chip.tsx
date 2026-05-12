"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
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

function computePopoverBox(anchor: HTMLElement) {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const width = Math.min(22 * 16, Math.max(17 * 16, vw - 20));
  let left = r.right - width;
  left = Math.max(10, Math.min(left, vw - width - 10));
  let top = r.bottom + 8;
  const maxH = Math.min(vh * 0.72, 22 * 16);
  if (top + maxH > vh - 8) {
    top = Math.max(8, r.top - maxH - 8);
  }
  return { top, left, width, maxH };
}

type PopoverProps = {
  lineId: string;
  anchorEl: HTMLElement | null;
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

export function PharmacistLineConversationPopover({
  lineId,
  anchorEl,
  open,
  onOpenChange,
  patientText,
  pharmacistDraft,
  onPharmacistDraftChange,
  allowEdit,
  showPersistButton,
  onPersist,
  persistBusy,
}: PopoverProps) {
  const uid = useId();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [layoutTick, setLayoutTick] = useState(0);

  const box = useMemo(() => {
    void layoutTick;
    if (!open || !anchorEl) return { top: 0, left: 0, width: 300, maxH: 360 };
    return computePopoverBox(anchorEl);
  }, [open, anchorEl, layoutTick]);

  useEffect(() => {
    if (!open || !anchorEl) return undefined;
    const bump = () => setLayoutTick((t) => t + 1);
    window.addEventListener("resize", bump);
    window.addEventListener("scroll", bump, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", bump);
    vv?.addEventListener("scroll", bump);
    return () => {
      window.removeEventListener("resize", bump);
      window.removeEventListener("scroll", bump, true);
      vv?.removeEventListener("resize", bump);
      vv?.removeEventListener("scroll", bump);
    };
  }, [open, anchorEl]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (anchorEl?.contains(t)) return;
      if (popoverRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, anchorEl, onOpenChange]);

  const titleId = `line-convo-${uid}-${lineId}`;

  if (!open || typeof document === "undefined" || !anchorEl) return null;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        maxHeight: box.maxH,
        zIndex: 10055,
      }}
      className="flex touch-manipulation flex-col overflow-hidden rounded-2xl border border-border/90 bg-card py-2.5 shadow-2xl ring-1 ring-black/10"
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
          className="shrink-0 rounded-lg border border-transparent p-1 text-muted-foreground hover:bg-muted/60"
          aria-label="Fermer"
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
    </div>,
    document.body
  );
}
