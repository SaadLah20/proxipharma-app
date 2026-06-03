"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Gift, Package } from "lucide-react";
import {
  CatalogProductPhotoThumb,
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { computePromoPackTotals, formatDh, type PromoLineWithPrice } from "@/lib/promo/pricing";

type PackSummaryVariant = "compact" | "default" | "detail" | "public";

export function PromoOfferPackSummary({
  lines,
  discountPercent,
  compact,
  variant = compact ? "compact" : "default",
}: {
  lines: PromoLineWithPrice[];
  discountPercent: number;
  /** @deprecated Préférer `variant="compact"` */
  compact?: boolean;
  variant?: PackSummaryVariant;
}) {
  const [preview, setPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const resolvedVariant: PackSummaryVariant = compact && variant === "default" ? "compact" : variant;
  const products = lines.filter((l) => l.line_kind === "product");
  const gifts = lines.filter((l) => l.line_kind === "gift");
  const { subtotal, discount, total } = computePromoPackTotals(lines, discountPercent);

  const isPublic = resolvedVariant === "public";
  const isDetail = resolvedVariant === "detail";
  const isCompact = resolvedVariant === "compact";
  const isRich = isDetail;

  return (
    <>
      <div
        className={clsx(
          isCompact || isPublic ? "space-y-2 text-xs" : isDetail ? "space-y-4" : "space-y-3 text-sm"
        )}
      >
        {products.length > 0 ? (
          <section>
            <SectionHeading
              icon={Package}
              label={isPublic ? "Produits" : "Produits du pack"}
              variant={resolvedVariant}
              tone="emerald"
            />
            <ul className={clsx("mt-1", isRich ? "grid gap-2.5 sm:grid-cols-2" : "space-y-1")}>
              {products.map((l, i) => (
                <li
                  key={l.id || i}
                  className={clsx(
                    "flex items-start gap-2",
                    isRich && "rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm"
                  )}
                >
                  <ProductThumb
                    photoUrl={l.photo_url}
                    productLabel={l.product_name ?? "Produit"}
                    variant={resolvedVariant}
                    onPreview={setPreview}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "font-medium leading-snug text-foreground [overflow-wrap:anywhere]",
                        isDetail ? "text-sm" : "text-[11px]"
                      )}
                    >
                      {l.product_name}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground/80">× {l.quantity}</span>
                      {l.price_pph != null ? (
                        <span className="block sm:inline">
                          <span className="hidden sm:inline"> · </span>
                          {formatDh(l.price_pph * l.quantity)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {gifts.length > 0 ? (
          <section
            className={clsx(
              isPublic && "rounded-lg border border-amber-200/70 bg-amber-50/50 px-2 py-1.5",
              isRich &&
                "rounded-xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/60 p-3 shadow-sm ring-1 ring-amber-200/60"
            )}
          >
            <SectionHeading icon={Gift} label="Cadeaux" variant={resolvedVariant} tone="amber" />
            <ul className={clsx("mt-1", isRich ? "space-y-2" : "space-y-1")}>
              {gifts.map((l, i) => (
                <li
                  key={l.id || `g-${i}`}
                  className={clsx(
                    "flex items-start gap-2 text-amber-950",
                    isRich && "rounded-lg border border-amber-200/70 bg-white/70 px-2.5 py-2 font-medium"
                  )}
                >
                  {isPublic || isRich ? (
                    <>
                      <ProductThumb
                        photoUrl={l.photo_url}
                        productLabel={l.product_name ?? l.label ?? "Cadeau"}
                        variant={resolvedVariant}
                        gift
                        onPreview={setPreview}
                      />
                      <span
                        className={clsx(
                          "min-w-0 flex-1 leading-snug [overflow-wrap:anywhere]",
                          isDetail ? "text-sm" : "text-[11px]"
                        )}
                      >
                        {l.product_name ?? l.label}
                        {l.quantity > 1 ? (
                          <span className="mt-0.5 block text-[10px] font-semibold tabular-nums text-amber-800/90">
                            × {l.quantity}
                          </span>
                        ) : null}
                      </span>
                    </>
                  ) : (
                    <>
                      <Gift className="size-3.5 shrink-0" aria-hidden />
                      <span>
                        {l.product_name ?? l.label}
                        {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {subtotal > 0 ? (
          <div
            className={clsx(
              "tabular-nums",
              isDetail
                ? "rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-sm"
                : "rounded-lg bg-muted/25 px-2 py-1.5 text-[11px]"
            )}
          >
            <p className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Sous-total</span>
              <span className="text-right tabular-nums">{formatDh(subtotal)}</span>
            </p>
            <p className="flex items-baseline justify-between gap-3 text-emerald-800">
              <span className="shrink-0">Remise −{discountPercent} %</span>
              <span className="text-right tabular-nums">−{formatDh(discount)}</span>
            </p>
            <p className="flex items-baseline justify-between gap-3 border-t border-border/50 pt-1 font-bold text-foreground">
              <span className="min-w-0 shrink leading-snug">
                {isPublic || isDetail ? "Prix du pack" : "Total pack"}
              </span>
              <span className="shrink-0 text-right tabular-nums">{formatDh(total)}</span>
            </p>
          </div>
        ) : null}
      </div>
      <PatientProductPhotoPreviewModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.title ?? ""}
        onClose={() => setPreview(null)}
      />
    </>
  );
}

function SectionHeading({
  icon: Icon,
  label,
  variant,
  tone,
}: {
  icon: typeof Package;
  label: string;
  variant: PackSummaryVariant;
  tone: "emerald" | "amber";
}) {
  if (variant === "public" || variant === "compact" || variant === "default") {
    return (
      <p
        className={clsx(
          "text-[10px] font-bold uppercase tracking-wide",
          tone === "amber" ? "text-amber-900/90" : "text-muted-foreground"
        )}
      >
        {label}
      </p>
    );
  }

  const iconWrap = tone === "amber" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground";

  return (
    <div className="flex items-center gap-2">
      <span className={clsx("inline-flex size-7 items-center justify-center rounded-full shadow-sm", iconWrap)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function ProductThumb({
  photoUrl,
  productLabel,
  variant,
  gift,
  onPreview,
}: {
  photoUrl?: string | null;
  productLabel: string;
  variant: PackSummaryVariant;
  gift?: boolean;
  onPreview: (preview: CatalogProductPhotoPreview) => void;
}) {
  const url = resolvePublicMediaUrl(photoUrl ?? null);
  const size = variant === "public" ? 40 : variant === "detail" ? 52 : variant === "compact" ? 32 : 40;
  const objectFit = variant === "public" ? "contain" : "cover";
  if (!url) {
    return (
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-lg",
          gift ? "bg-amber-100 text-amber-800" : variant === "public" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
        )}
        style={{ width: size, height: size }}
      >
        {gift ? <Gift className="size-5" aria-hidden /> : <Package className="size-4" aria-hidden />}
      </span>
    );
  }
  return (
    <CatalogProductPhotoThumb
      imageUrl={url}
      title={productLabel}
      size={size}
      objectFit={objectFit}
      className={variant === "public" ? "rounded-md" : undefined}
      imageClassName={gift ? "border-amber-200/60" : undefined}
      onPreview={onPreview}
    />
  );
}
