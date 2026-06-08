"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Gift, Package } from "lucide-react";
import {
  CatalogProductPhotoThumb,
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { promoProductDisplayName } from "@/lib/promo/display";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { computePromoPackTotals, formatDh, type PromoLineWithPrice } from "@/lib/promo/pricing";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";

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
  const isRich = isDetail || isPublic;

  return (
    <>
      <div className={clsx(isDetail ? "space-y-4" : "space-y-3")}>
        {products.length > 0 ? (
          <section>
            <SectionHeading
              icon={Package}
              label={isPublic ? "Produits" : "Produits du pack"}
              variant={resolvedVariant}
              tone="emerald"
            />
            <ul
              className={clsx(
                "mt-2",
                isRich ? "grid gap-2.5 sm:grid-cols-2" : "space-y-2",
              )}
            >
              {products.map((line, index) => (
                <PromoPackLineCard
                  key={line.id || `p-${index}`}
                  line={line}
                  variant={resolvedVariant}
                  onPreview={setPreview}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {gifts.length > 0 ? (
          <section
            className={clsx(
              isPublic && "rounded-xl border px-2.5 py-2.5",
              isPublic && pt.giftBlock,
              isDetail && pt.giftBlockRich,
            )}
          >
            <SectionHeading icon={Gift} label="Cadeaux" variant={resolvedVariant} tone="amber" />
            <ul
              className={clsx(
                "mt-2",
                isRich ? "grid gap-2.5 sm:grid-cols-2" : "space-y-2",
              )}
            >
              {gifts.map((line, index) => (
                <PromoPackLineCard
                  key={line.id || `g-${index}`}
                  line={line}
                  variant={resolvedVariant}
                  gift
                  onPreview={setPreview}
                />
              ))}
            </ul>
          </section>
        ) : null}

        {subtotal > 0 ? (
          <div
            className={clsx(
              "tabular-nums",
              isDetail ? pt.totalsBlockDetail : isPublic ? "rounded-xl border border-emerald-200/70 bg-emerald-50/40 px-3 py-2.5 text-xs" : "rounded-lg bg-muted/25 px-2 py-1.5 text-[11px]",
            )}
          >
            <p className="flex items-baseline justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Sous-total</span>
              <span className="text-right tabular-nums">{formatDh(subtotal)}</span>
            </p>
            <p className={clsx("flex items-baseline justify-between gap-3", pt.discountLine)}>
              <span className="shrink-0">Remise −{discountPercent} %</span>
              <span className="text-right tabular-nums">−{formatDh(discount)}</span>
            </p>
            <p className="flex items-baseline justify-between gap-3 border-t border-border/50 pt-1.5 font-bold text-foreground">
              <span className="min-w-0 shrink leading-snug">
                {isPublic || isDetail ? "Prix du pack" : "Total pack"}
              </span>
              <span className="shrink-0 text-right text-base tabular-nums">{formatDh(total)}</span>
            </p>
          </div>
        ) : null}
      </div>
      <PatientProductPhotoPreviewModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.title ?? ""}
        brand={preview?.brand}
        productType={preview?.product_type}
        descriptionHtml={preview?.descriptionHtml}
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
          tone === "amber" ? pt.giftTextMuted : "text-muted-foreground",
        )}
      >
        {label}
      </p>
    );
  }

  const iconWrap = tone === "amber" ? "bg-amber-500 text-white" : "bg-emerald-600 text-white";

  return (
    <div className="flex items-center gap-2">
      <span className={clsx("inline-flex size-7 items-center justify-center rounded-full shadow-sm", iconWrap)}>
        <Icon className="size-3.5" aria-hidden />
      </span>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function PromoPackLineCard({
  line,
  variant,
  gift = false,
  onPreview,
}: {
  line: PromoLineWithPrice;
  variant: PackSummaryVariant;
  gift?: boolean;
  onPreview: (preview: CatalogProductPhotoPreview) => void;
}) {
  const isPublic = variant === "public";
  const isDetail = variant === "detail";
  const isRich = isPublic || isDetail;
  const label = promoProductDisplayName(line.product_name ?? line.label, gift ? "Cadeau" : "Produit");
  const photoSize = isDetail ? 64 : isPublic ? 56 : 44;
  const lineTotal = line.price_pph != null ? line.price_pph * line.quantity : null;

  return (
    <li
      className={clsx(
        "flex min-w-0 items-start gap-2.5",
        isRich &&
          clsx(
            "rounded-xl border bg-white p-2.5 shadow-sm",
            gift ? "border-amber-200/80" : isPublic ? "border-emerald-200/70" : "border-slate-200/90",
          ),
        gift && !isRich && pt.giftText,
      )}
    >
      <div className="relative shrink-0">
        <ProductThumb
          line={line}
          productLabel={label}
          variant={variant}
          gift={gift}
          size={photoSize}
          onPreview={onPreview}
        />
        <QtyBadge quantity={line.quantity} gift={gift} />
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <p
          className={clsx(
            "font-semibold leading-snug text-foreground [overflow-wrap:anywhere]",
            isDetail ? "text-sm" : isPublic ? "text-[12px]" : "text-[11px]",
            !isRich && "line-clamp-2",
            isRich && "line-clamp-3",
          )}
        >
          {label}
        </p>

        {gift ? (
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800/90">Offert</p>
        ) : line.price_pph != null ? (
          <div className="mt-1 space-y-0.5 text-[10px] tabular-nums text-muted-foreground">
            <p>
              <span className="font-medium text-foreground/75">{formatDh(line.price_pph)}</span>
              <span> / unité</span>
            </p>
            {line.quantity > 1 && lineTotal != null ? (
              <p className="font-bold text-foreground">{formatDh(lineTotal)}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function QtyBadge({ quantity, gift }: { quantity: number; gift?: boolean }) {
  return (
    <span
      className={clsx(
        "absolute -bottom-1.5 -right-1.5 flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-md ring-2 ring-white",
        gift ? "bg-amber-600" : "bg-emerald-600",
      )}
      aria-label={`Quantité ${quantity}`}
    >
      ×{quantity}
    </span>
  );
}

function ProductThumb({
  line,
  productLabel,
  variant,
  gift,
  size,
  onPreview,
}: {
  line: PromoLineWithPrice;
  productLabel: string;
  variant: PackSummaryVariant;
  gift?: boolean;
  size: number;
  onPreview: (preview: CatalogProductPhotoPreview) => void;
}) {
  const url = resolvePublicMediaUrl(line.photo_url ?? null);
  const descriptionHtml = productDescriptionHtmlForDisplay(line.full_description);
  const isPublic = variant === "public";

  if (!url) {
    return (
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-xl border",
          gift ? "border-amber-200 bg-amber-50 text-amber-700" : isPublic ? pt.productThumb : "border-border/80 bg-muted text-muted-foreground",
        )}
        style={{ width: size, height: size }}
      >
        {gift ? <Gift className={size >= 56 ? "size-6" : "size-5"} aria-hidden /> : <Package className={size >= 56 ? "size-5" : "size-4"} aria-hidden />}
      </span>
    );
  }

  return (
    <CatalogProductPhotoThumb
      imageUrl={url}
      title={productLabel}
      brand={line.brand}
      productType={line.product_type}
      descriptionHtml={descriptionHtml}
      size={size}
      objectFit="contain"
      className="rounded-xl border border-border/60 bg-white"
      imageClassName={gift ? pt.giftThumbBorder : undefined}
      onPreview={onPreview}
    />
  );
}
