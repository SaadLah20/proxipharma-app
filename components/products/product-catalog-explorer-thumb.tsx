"use client";

import { clsx } from "clsx";
import { Package, Pill } from "lucide-react";
import { isMedicamentProductType } from "@/components/products/product-brand-label";
import { externalCatalogImageProps } from "@/lib/storage-media";

/** Vignette explorateur catalogue : photo si dispo, sinon icône para ou médicament — toujours cliquable. */
export function ProductCatalogExplorerThumb({
  photoUrl,
  productType,
  productName,
  className,
  ringClassName,
  onOpenPreview,
}: {
  photoUrl: string | null | undefined;
  productType?: string | null;
  productName: string;
  className?: string;
  ringClassName?: string;
  onOpenPreview: () => void;
}) {
  const url = photoUrl?.trim();
  const medicament = isMedicamentProductType(productType);
  const PlaceholderIcon = medicament ? Pill : Package;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenPreview();
      }}
      className={clsx(
        className,
        "cursor-zoom-in overflow-hidden hover:ring-2 focus:outline-none focus-visible:ring-2",
        ringClassName
      )}
      aria-label={`Voir la fiche produit · ${productName}`}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="pointer-events-none h-full w-full object-cover"
          {...externalCatalogImageProps}
        />
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
    </button>
  );
}
