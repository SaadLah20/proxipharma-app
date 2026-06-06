"use client";

import { useEffect } from "react";
import Image from "next/image";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { lockBodyScroll } from "@/lib/ui-body-scroll-lock";
import { ProductCatalogMetaLabel } from "@/components/products/product-brand-label";
import { ProductPhotoComingSoonFrame } from "@/components/products/product-photo-coming-soon-frame";

export type CatalogProductPhotoPreview = {
  url?: string | null;
  title: string;
  brand?: string | null;
  product_type?: string | null;
  descriptionHtml?: string | null;
  /** Explorateur catalogue sans photo : libellé pied de modale « fiche catalogue ». */
  catalogExplorerPreview?: boolean;
};

export type ProductPhotoPreviewOpenOptions = {
  catalogExplorerPreview?: boolean;
};

export type ProductPhotoPreviewHandler = (
  url: string | null,
  title: string,
  descriptionHtml?: string | null,
  brand?: string | null,
  productType?: string | null,
  options?: ProductPhotoPreviewOpenOptions
) => void;

/** Vignette catalogue cliquable → ouvre `PatientProductPhotoPreviewModal` via `onPreview`. */
export function CatalogProductPhotoThumb({
  imageUrl,
  title,
  brand,
  productType,
  descriptionHtml,
  size,
  className,
  imageClassName,
  objectFit = "cover",
  onPreview,
}: {
  imageUrl: string;
  title: string;
  brand?: string | null;
  productType?: string | null;
  descriptionHtml?: string | null;
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
        onPreview({
          url: imageUrl,
          title,
          brand: brand ?? null,
          product_type: productType ?? null,
          descriptionHtml: descriptionHtml ?? null,
        });
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
  brand,
  productType,
  descriptionHtml,
  catalogExplorerPreview = false,
  onClose,
}: {
  open: boolean;
  imageUrl: string | null;
  title: string;
  brand?: string | null;
  productType?: string | null;
  descriptionHtml?: string | null;
  catalogExplorerPreview?: boolean;
  onClose: () => void;
}) {
  const tModal = useTranslations("modals.photoPreview");
  const tCommon = useTranslations("common");
  const tPublic = useTranslations("demandePublic");

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

  if (!open) return null;

  const showComingSoonPhoto = !imageUrl?.trim();
  const hasDescription = Boolean(descriptionHtml?.trim());

  return createPortal(
    <div className="fixed inset-0 z-[20050] flex items-center justify-center p-2 sm:p-5" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
        aria-label={tModal("closePreviewAria")}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="patient-photo-preview-title"
        className={clsx(
          "relative z-10 flex max-h-[min(94dvh,900px)] w-full flex-col overflow-hidden rounded-2xl border-2 border-border bg-card shadow-2xl",
          descriptionHtml?.trim() ? "max-w-6xl" : "max-w-5xl"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-20 flex shrink-0 items-start justify-between gap-2 border-b border-border/80 bg-card px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1 pr-2">
            <h2
              id="patient-photo-preview-title"
              className="min-w-0 break-words text-sm font-bold leading-snug text-foreground sm:text-base"
            >
              {title}
            </h2>
            <ProductCatalogMetaLabel
              productType={productType}
              brand={brand}
              variant="modal"
              className="mt-1"
            />
          </div>
          <button
            type="button"
            className="relative z-10 shrink-0 rounded-lg border border-border/80 bg-card p-1.5 text-foreground shadow-sm hover:bg-muted/70"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div
          className={clsx(
            "flex min-h-0 flex-1 flex-col overflow-hidden",
            hasDescription ? "lg:flex-row lg:gap-0" : ""
          )}
        >
          <div
            className={clsx(
              "flex min-h-0 items-center justify-center overflow-hidden bg-gradient-to-b from-muted/40 to-muted/15 p-3 sm:p-4",
              hasDescription
                ? "max-h-[min(38dvh,320px)] shrink-0 lg:max-h-none lg:min-h-0 lg:flex-[1.1] lg:basis-0"
                : "min-h-[min(32dvh,280px)] flex-1 sm:min-h-[min(40dvh,360px)]"
            )}
          >
            {showComingSoonPhoto ? (
              <ProductPhotoComingSoonFrame className="h-full max-h-full min-h-0 w-full max-w-md" />
            ) : (
              <div className="flex h-full max-h-full w-full min-h-0 items-center justify-center">
                <img
                  src={imageUrl!}
                  alt=""
                  className="max-h-full max-w-full rounded-lg object-contain shadow-md ring-1 ring-black/5"
                />
              </div>
            )}
          </div>
          {hasDescription ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border/80 lg:max-w-[min(42%,28rem)] lg:border-l lg:border-t-0">
              <p className="shrink-0 border-b border-border/60 bg-muted/15 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
                {tModal("description")}
              </p>
              <div
                className="product-description-html min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 text-[13px] leading-relaxed text-foreground [-webkit-overflow-scrolling:touch] [&_li]:ml-4 [&_p+p]:mt-2 [&_ul]:list-disc [&_ul]:pl-4"
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>
          ) : null}
        </div>
        <p className="shrink-0 border-t border-border/60 bg-muted/15 px-3 py-2 text-center text-[10px] text-muted-foreground sm:text-[11px]">
          {showComingSoonPhoto && catalogExplorerPreview
            ? tPublic("photoPreviewCatalogFooter")
            : tPublic("photoPreviewIndicativeFooter")}
        </p>
      </div>
    </div>,
    document.body
  );
}
