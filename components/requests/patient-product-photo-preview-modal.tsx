"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Aperçu plein écran (patient) : photo catalogue / ligne, fermeture Échap ou clic extérieur.
 */
export function PatientProductPhotoPreviewModal({
  open,
  imageUrl,
  title,
  onClose,
}: {
  open: boolean;
  imageUrl: string | null;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !imageUrl) return null;

  return createPortal(
    <div className="fixed inset-0 z-[20050] flex items-center justify-center p-2 sm:p-5" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label="Fermer l’aperçu photo"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-photo-preview-title"
        className="relative z-10 flex max-h-[min(94dvh,900px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/80 bg-muted/20 px-3 py-2.5 sm:px-4">
          <h2 id="patient-photo-preview-title" className="min-w-0 flex-1 text-sm font-bold leading-snug text-foreground sm:text-base">
            {title}
          </h2>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border/80 bg-background p-1.5 text-muted-foreground shadow-sm hover:bg-muted/70 hover:text-foreground"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="flex min-h-[min(50dvh,420px)] flex-1 items-center justify-center bg-gradient-to-b from-muted/40 to-muted/15 p-2 sm:p-6">
          <img
            src={imageUrl}
            alt=""
            className="max-h-[min(78dvh,720px)] w-auto max-w-full rounded-lg object-contain shadow-md ring-1 ring-black/5"
          />
        </div>
        <p className="border-t border-border/60 bg-muted/15 px-3 py-2 text-center text-[10px] text-muted-foreground sm:text-[11px]">
          Photo fournie par la pharmacie ou le catalogue — visuel indicatif.
        </p>
      </div>
    </div>,
    document.body
  );
}
