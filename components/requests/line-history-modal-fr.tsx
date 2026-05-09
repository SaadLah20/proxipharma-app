"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PatientLineTimelineBlockFr } from "@/lib/build-patient-line-timeline-fr";

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer" onClick={onClose} />
      <div className="relative z-10 flex max-h-[min(90dvh,34rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-border px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Historique produit</p>
            <p className="truncate text-[12px] font-semibold leading-tight">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-1 text-foreground hover:bg-muted" aria-label="Fermer">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-2.5 py-2">
          {blocks.length === 0 ? (
            <p className="text-[12px] leading-snug text-muted-foreground">
              Impossible d&apos;afficher la chronologie. Consultez l&apos;historique du dossier sur la page.
            </p>
          ) : (
            <ol className="relative ms-2 space-y-2 border-s border-border/90 ps-3">
              {blocks.map((b) => (
                <li key={b.id} className="relative">
                  <span
                    className={`absolute -start-[17px] top-2 size-2 rounded-full border bg-background shadow-sm ${
                      b.isCurrent ? "border-emerald-500 ring-1 ring-emerald-200/80" : "border-muted-foreground/40"
                    }`}
                    aria-hidden
                  />
                  <div
                    className={`rounded-md border px-2 py-1.5 ${
                      b.isCurrent ? "border-emerald-200/80 bg-emerald-50/55" : "border-border/80 bg-muted/20"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
                      <p className="text-[11px] font-semibold leading-snug">{b.title}</p>
                      <time className="shrink-0 text-[9px] tabular-nums text-muted-foreground" dateTime={b.atIso ?? undefined}>
                        {b.atLabel}
                      </time>
                    </div>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">{b.actorLabel}</p>
                    <p className="mt-1 whitespace-pre-wrap text-[10px] leading-snug text-foreground">{b.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
