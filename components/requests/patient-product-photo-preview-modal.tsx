"use client";

import { useEffect } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { lockBodyScroll } from "@/lib/ui-body-scroll-lock";

export type CatalogProductPhotoPreview = { url: string; title: string };

/** Vignette catalogue cliquable → ouvre `PatientProductPhotoPreviewModal` via `onPreview`. */
export function CatalogProductPhotoThumb({
  imageUrl,
  title,
  size,
  className,
  imageClassName,
  objectFit = "cover",
  onPreview,
}: {
  imageUrl: string;
  title: string;
  size: number;
  className?: string;
  imageClassName?: string;
  objectFit?: "cover" | "contain";
  onPreview: (preview: CatalogProductPhotoPreview) => void;
}) {
  return (
    <button
      type="button"
      className={clsx(
        "relative shrink-0 overflow-hidden rounded-md border border-slate-200/80 bg-white",
        "cursor-zoom-in ring-offset-2 hover:ring-2 hover:ring-sky-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        className
      )}
      style={{ width: size, height: size }}
      aria-label={`Agrandir ${title}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPreview({ url: imageUrl, title });
      }}
    >
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        className={clsx("size-full", objectFit === "contain" ? "object-contain p-0.5" : "object-cover", imageClassName)}
        unoptimized
      />
    </button>
  );
}

/**
 * Aperçu plein écran : photo catalogue / ligne (demandes produits, packs promo, etc.).
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
    const releaseScroll = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      releaseScroll();
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
