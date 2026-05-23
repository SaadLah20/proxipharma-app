"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Gift, Package, Sparkles } from "lucide-react";
import {
  CatalogProductPhotoThumb,
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { computePromoPackTotals, formatDh, type PromoLineWithPrice } from "@/lib/promo/pricing";

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
  variant?: "compact" | "default" | "detail";
}) {
  const [preview, setPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const resolvedVariant = compact && variant === "default" ? "compact" : variant;
  const products = lines.filter((l) => l.line_kind === "product");
  const gifts = lines.filter((l) => l.line_kind === "gift");
  const { subtotal, discount, total } = computePromoPackTotals(lines, discountPercent);

  const isDetail = resolvedVariant === "detail";
  const isCompact = resolvedVariant === "compact";

  return (
    <>
      <div className={clsx(isCompact ? "space-y-2 text-xs" : isDetail ? "space-y-4" : "space-y-3 text-sm")}>
        {products.length > 0 ? (
          <div>
            <p
              className={clsx(
                "font-bold uppercase tracking-wide text-muted-foreground",
                isDetail ? "text-[11px]" : "text-[10px]"
              )}
            >
              Produits du pack
            </p>
            <ul className={clsx("mt-2", isDetail ? "grid gap-2 sm:grid-cols-2" : "space-y-1.5")}>
              {products.map((l, i) => (
                <li
                  key={l.id || i}
                  className={clsx(
                    "flex items-center gap-2.5",
                    isDetail && "rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm"
                  )}
                >
                  <ProductThumb
                    photoUrl={l.photo_url}
                    productLabel={l.product_name ?? "Produit"}
                    variant={resolvedVariant}
                    onPreview={setPreview}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={clsx("font-semibold text-foreground", isDetail && "text-sm leading-snug")}>
                      {l.product_name}
                    </p>
                    <p className={clsx("text-muted-foreground", isDetail ? "text-xs" : "text-[11px]")}>
                      Quantité × {l.quantity}
                      {l.price_pph != null && !isCompact ? (
                        <span className="tabular-nums"> · {formatDh(l.price_pph * l.quantity)} indicatif</span>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {gifts.length > 0 ? (
          <div
            className={clsx(
              isDetail &&
                "rounded-xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 via-orange-50/90 to-amber-100/60 p-3 shadow-sm ring-1 ring-amber-200/60"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "inline-flex items-center justify-center rounded-full bg-amber-500 text-white shadow-sm",
                  isDetail ? "size-8" : "size-6"
                )}
              >
                <Gift className={isDetail ? "size-4" : "size-3.5"} aria-hidden />
              </span>
              <div>
                <p
                  className={clsx(
                    "font-bold uppercase tracking-wide text-amber-950",
                    isDetail ? "text-xs" : "text-[10px]"
                  )}
                >
                  Cadeaux offerts
                </p>
                {isDetail ? (
                  <p className="text-[11px] text-amber-900/80">Inclus dans ce pack sans supplément</p>
                ) : null}
              </div>
              {isDetail ? <Sparkles className="ml-auto size-5 text-amber-600/70" aria-hidden /> : null}
            </div>
            <ul className={clsx("mt-2.5", isDetail ? "space-y-2" : "mt-1 space-y-1")}>
              {gifts.map((l, i) => (
                <li
                  key={l.id || `g-${i}`}
                  className={clsx(
                    "flex items-center gap-2.5 font-medium text-amber-950",
                    isDetail && "rounded-lg border border-amber-200/70 bg-white/70 px-2.5 py-2"
                  )}
                >
                  {isDetail ? (
                    <ProductThumb
                      photoUrl={l.photo_url}
                      productLabel={l.product_name ?? l.label ?? "Cadeau"}
                      variant="detail"
                      gift
                      onPreview={setPreview}
                    />
                  ) : (
                    <Gift className="size-3.5 shrink-0" aria-hidden />
                  )}
                  <span className={clsx(isDetail && "text-sm leading-snug")}>
                    {l.product_name ?? l.label}
                    {l.quantity > 1 ? ` × ${l.quantity}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {subtotal > 0 ? (
          <div
            className={clsx(
              "tabular-nums",
              isDetail
                ? "rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-3 py-2.5 text-sm"
                : "rounded-lg bg-muted/25 px-2.5 py-2 text-[11px]"
            )}
          >
            <p className="flex justify-between">
              <span className="text-muted-foreground">Prix indicatif</span>
              <span>{formatDh(subtotal)}</span>
            </p>
            <p className="flex justify-between text-emerald-800">
              <span>Remise −{discountPercent} %</span>
              <span>−{formatDh(discount)}</span>
            </p>
            <p className="flex justify-between border-t border-border/50 pt-1 font-bold">
              <span>Total pack</span>
              <span>{formatDh(total)}</span>
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

function ProductThumb({
  photoUrl,
  productLabel,
  variant,
  gift,
  onPreview,
}: {
  photoUrl?: string | null;
  productLabel: string;
  variant: "compact" | "default" | "detail";
  gift?: boolean;
  onPreview: (preview: CatalogProductPhotoPreview) => void;
}) {
  const url = resolvePublicMediaUrl(photoUrl ?? null);
  const size = variant === "detail" ? 52 : variant === "compact" ? 32 : 40;
  if (!url) {
    return (
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-md",
          gift ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
        )}
        style={{ width: size, height: size }}
      >
        {gift ? <Gift className="size-4" aria-hidden /> : <Package className="size-3.5" aria-hidden />}
      </span>
    );
  }
  return (
    <CatalogProductPhotoThumb
      imageUrl={url}
      title={productLabel}
      size={size}
      imageClassName={variant === "detail" ? "border-amber-200/60" : undefined}
      onPreview={onPreview}
    />
  );
}
