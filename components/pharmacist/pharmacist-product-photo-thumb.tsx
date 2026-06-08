"use client";

import { clsx } from "clsx";
import { ProductLinePhotoThumb } from "@/components/products/product-line-photo-thumb";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";

/** Vignette produit cliquable (aperçu photo + description) — parcours pharmacien. */
export function PharmacistProductPhotoThumb({
  photoUrl,
  title,
  brand,
  productType,
  descriptionHtml,
  onPhotoPreview,
  catalogExplorerPreview = false,
  className,
}: {
  photoUrl: string | null | undefined;
  title: string;
  brand?: string | null;
  productType?: string | null;
  descriptionHtml?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
  /** Recherche catalogue : fiche produit avec photo « disponible prochainement ». */
  catalogExplorerPreview?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <ProductLinePhotoThumb
      photoUrl={photoUrl}
      productType={productType}
      productName={title}
      descriptionHtml={descriptionHtml}
      brand={brand}
      onPhotoPreview={onPhotoPreview}
      className={clsx("h-full w-full", className)}
      ringClassName="focus-visible:ring-sky-500 focus-visible:ring-offset-1"
      catalogExplorerPreview={catalogExplorerPreview ? true : undefined}
    />
  );
}
