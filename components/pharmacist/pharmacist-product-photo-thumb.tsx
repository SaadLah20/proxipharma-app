"use client";

import { clsx } from "clsx";
import { Package } from "lucide-react";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";

/** Vignette produit cliquable (aperçu photo + description) — parcours pharmacien. */
export function PharmacistProductPhotoThumb({
  photoUrl,
  title,
  descriptionHtml,
  onPhotoPreview,
  className,
  iconClassName,
  placeholderIcon: PlaceholderIcon = Package,
}: {
  photoUrl: string | null | undefined;
  title: string;
  descriptionHtml?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
  className?: string;
  iconClassName?: string;
  placeholderIcon?: typeof Package;
}) {
  const url = photoUrl?.trim();
  if (!url) {
    return (
      <div
        className={clsx(
          "flex h-full w-full items-center justify-center bg-muted/30 text-muted-foreground",
          className
        )}
      >
        <PlaceholderIcon className={clsx("size-5", iconClassName)} aria-hidden />
      </div>
    );
  }

  if (!onPhotoPreview) {
    return <img src={url} alt="" className={clsx("h-full w-full object-cover", className)} />;
  }

  return (
    <button
      type="button"
      className={clsx(
        "relative h-full w-full cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1",
        className
      )}
      aria-label={`Agrandir la photo · ${title}`}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPhotoPreview(url, title, descriptionHtml);
      }}
    >
      <img src={url} alt="" className="pointer-events-none h-full w-full object-cover" />
    </button>
  );
}
