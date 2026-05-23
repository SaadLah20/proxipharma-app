"use client";

import Image from "next/image";
import { Gift, Package } from "lucide-react";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { computePromoPackTotals, formatDh, type PromoLineWithPrice } from "@/lib/promo/pricing";

export function PromoOfferPackSummary({
  lines,
  discountPercent,
  compact,
}: {
  lines: PromoLineWithPrice[];
  discountPercent: number;
  compact?: boolean;
}) {
  const products = lines.filter((l) => l.line_kind === "product");
  const gifts = lines.filter((l) => l.line_kind === "gift");
  const { subtotal, discount, total } = computePromoPackTotals(lines, discountPercent);

  return (
    <div className={compact ? "space-y-2 text-xs" : "space-y-3 text-sm"}>
      {products.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Produits</p>
          <ul className="mt-1 space-y-1.5">
            {products.map((l, i) => (
              <li key={l.id || i} className="flex items-center gap-2">
                <ProductThumb photoUrl={l.photo_url} name={l.product_name} compact={compact} />
                <span className="min-w-0 flex-1 font-medium">
                  {l.product_name} × {l.quantity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {gifts.length > 0 ? (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Cadeaux</p>
          <ul className="mt-1 space-y-1">
            {gifts.map((l, i) => (
              <li key={l.id || `g-${i}`} className="flex items-center gap-2 text-amber-950">
                <Gift className="size-3.5 shrink-0" aria-hidden />
                {l.product_name ?? l.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {subtotal > 0 ? (
        <div className="rounded-lg bg-muted/25 px-2.5 py-2 text-[11px] tabular-nums">
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
  );
}

function ProductThumb({
  photoUrl,
  name,
  compact,
}: {
  photoUrl?: string | null;
  name?: string | null;
  compact?: boolean;
}) {
  const url = resolvePublicMediaUrl(photoUrl ?? null);
  const size = compact ? 32 : 40;
  if (!url) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
        style={{ width: size, height: size }}
      >
        <Package className="size-3.5" aria-hidden />
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt=""
      width={size}
      height={size}
      className="size-8 shrink-0 rounded-md border object-cover sm:size-10"
      unoptimized
    />
  );
}
