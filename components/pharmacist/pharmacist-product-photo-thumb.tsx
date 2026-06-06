"use client";

import { clsx } from "clsx";
import { Package, Pill } from "lucide-react";
import { isMedicamentProductType } from "@/components/products/product-brand-label";
import { ProductCatalogExplorerThumb } from "@/components/products/product-catalog-explorer-thumb";
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
  iconClassName,
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
  const url = photoUrl?.trim();

  if (catalogExplorerPreview && onPhotoPreview) {
    return (
      <ProductCatalogExplorerThumb
        photoUrl={url || null}
        productType={productType}
        productName={title}
        className={clsx("h-full w-full", className)}
        ringClassName="focus-visible:ring-sky-500 focus-visible:ring-offset-1"
        onOpenPreview={() =>
          onPhotoPreview(url || null, title, descriptionHtml, brand, productType, {
            catalogExplorerPreview: true,
          })
        }
      />
    );
  }

  if (!url) {
    const medicament = isMedicamentProductType(productType);
    const PlaceholderIcon = medicament ? Pill : Package;
    return (
      <div
        className={clsx(
          "flex h-full w-full items-center justify-center",
          medicament ? "bg-sky-50/95 text-sky-700" : "bg-muted/30 text-muted-foreground",
          className
        )}
      >
        <PlaceholderIcon
          className={clsx(medicament ? "size-[1.35rem]" : "size-5", iconClassName)}
          strokeWidth={medicament ? 2.25 : 1.75}
          aria-hidden
        />
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
        onPhotoPreview(url, title, descriptionHtml, brand, productType);
      }}
    >
      <img src={url} alt="" className="pointer-events-none h-full w-full object-cover" />
    </button>
  );
}
