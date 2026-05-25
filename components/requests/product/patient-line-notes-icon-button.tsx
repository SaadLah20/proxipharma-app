"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X } from "lucide-react";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

/** Bouton notes ligne (lecture seule), même gabarit que Historique sur carte validée. */
export function PatientLineNotesIconButton({
  productName,
  client,
  pharmacist,
}: {
  productName: string;
  client: string;
  pharmacist: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const c = client.trim();
  const p = pharmacist.trim();
  if (!c && !p) return null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-sky-300/80 bg-white text-sky-800 shadow-sm hover:bg-sky-50"
        aria-label="Voir les messages sur ce produit"
        title="Messages"
      >
        <MessageCircle className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className={cn(
                  "max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl",
                  t.modalShell
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={cn("flex items-start justify-between gap-2 border-b px-3 py-2", t.modalHeader)}>
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="block">Message</span>
                      <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">
                        {productName}
                      </span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(60vh,16rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {c ? (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{c}</p>
                    </div>
                  ) : null}
                  {p ? (
                    <div className="rounded-lg border border-violet-200/80 bg-violet-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-violet-900">Pharmacie</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-violet-950">{p}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
