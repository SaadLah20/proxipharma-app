"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import type { PatientLineTimelineBlockFr } from "@/lib/build-patient-line-timeline-fr";
import { HistoryTimelineFr } from "@/components/requests/history-timeline-fr";

export function LineHistoryModalFr({
  open,
  title,
  blocks,
  onClose,
}: {
  open: boolean;
  title: string;
  blocks: PatientLineTimelineBlockFr[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const stepCount = blocks.filter((b) => !b.isCurrent).length;

  return (
    <AppModalOverlay open={open} onBackdropClick={onClose} aria-labelledby="line-history-title">
      <div className="relative z-10 flex max-h-[min(calc(100dvh-5.5rem),36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:max-h-[min(90dvh,36rem)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-2.5 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
              Historique du produit
            </p>
            <p id="line-history-title" className="truncate text-[13px] font-semibold leading-tight">
              {title}
            </p>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
              {stepCount > 0
                ? `${stepCount} étape${stepCount > 1 ? "s" : ""} — racontée du début à aujourd’hui.`
                : "Parcours de ce produit dans le dossier."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1 text-foreground hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-2.5 py-3 pb-6">
          <HistoryTimelineFr
            blocks={blocks}
            showPhaseChapters
            emptyLabel="Impossible d'afficher la chronologie. Consultez l'historique du dossier sur la page."
          />
        </div>
      </div>
    </AppModalOverlay>
  );
}
