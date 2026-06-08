"use client";

import { clsx } from "clsx";
import { Package, Pill } from "lucide-react";
import { isMedicamentProductType } from "@/components/products/product-brand-label";
import { ProductCatalogExplorerThumb } from "@/components/products/product-catalog-explorer-thumb";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";

/** Vignette ligne dossier (patient / pharmacien) — toujours cliquable si `onPhotoPreview` est fourni. */
export function ProductLinePhotoThumb({
  photoUrl,
  productType,
  productName,
  descriptionHtml,
  brand,
  onPhotoPreview,
  className = "size-full",
  ringClassName = "focus-visible:ring-sky-500 focus-visible:ring-offset-1",
  catalogExplorerPreview,
}: {
  photoUrl?: string | null;
  productType?: string | null;
  productName: string;
  descriptionHtml?: string | null;
  brand?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
  className?: string;
  ringClassName?: string;
  /** Pied de modale « fiche catalogue » (recherche catalogue pharmacien). Sinon : auto si pas de photo. */
  catalogExplorerPreview?: boolean;
}) {
  const url = photoUrl?.trim() || null;

  if (onPhotoPreview) {
    return (
      <ProductCatalogExplorerThumb
        photoUrl={url}
        productType={productType}
        productName={productName}
        className={className}
        ringClassName={ringClassName}
        onOpenPreview={() =>
          onPhotoPreview(url, productName, descriptionHtml, brand, productType, {
            catalogExplorerPreview: catalogExplorerPreview ?? !url,
          })
        }
      />
    );
  }

  const medicament = isMedicamentProductType(productType);
  const PlaceholderIcon = medicament ? Pill : Package;

  return (
    <div className={clsx(className, "overflow-hidden")}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={clsx(
            "flex h-full w-full items-center justify-center",
            medicament ? "bg-sky-50/95 text-sky-700" : "bg-muted/30 text-muted-foreground"
          )}
        >
          <PlaceholderIcon
            className={clsx(medicament ? "size-[1.35rem]" : "size-5")}
            strokeWidth={medicament ? 2.25 : 1.75}
            aria-hidden
          />
        </span>
      )}
    </div>
  );
}
