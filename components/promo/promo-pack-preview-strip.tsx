"use client";

import { clsx } from "clsx";
import { Gift, Package } from "lucide-react";
import { promoProductDisplayName } from "@/lib/promo/display";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import { resolvePublicMediaUrl } from "@/lib/storage-media";

export function PromoPackPreviewStrip({
  lines,
  maxItems = 5,
}: {
  lines: PromoLineWithPrice[];
  maxItems?: number;
}) {
  if (!lines.length) return null;

  const visible = lines.slice(0, maxItems);
  const overflow = lines.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Aperçu du pack">
      {visible.map((line, index) => {
        const isGift = line.line_kind === "gift";
        const label = promoProductDisplayName(line.product_name ?? line.label, isGift ? "Cadeau" : "Produit");
        const photo = resolvePublicMediaUrl(line.photo_url ?? null);

        return (
          <div
            key={line.id || `${line.line_kind}-${index}`}
            className="relative shrink-0"
            title={`${label} · ${line.quantity}`}
          >
            {photo ? (
              <img
                src={photo}
                alt=""
                className={clsx(
                  "size-10 rounded-lg border bg-white object-cover shadow-sm",
                  isGift ? "border-amber-200/90" : "border-emerald-200/80",
                )}
              />
            ) : (
              <span
                className={clsx(
                  "flex size-10 items-center justify-center rounded-lg border shadow-sm",
                  isGift ? "border-amber-200/90 bg-amber-50 text-amber-700" : "border-emerald-200/80 bg-emerald-50 text-emerald-700",
                )}
              >
                {isGift ? <Gift className="size-4" aria-hidden /> : <Package className="size-4" aria-hidden />}
              </span>
            )}
            <span
              className={clsx(
                "absolute -bottom-1 -right-1 flex min-w-[1.15rem] items-center justify-center rounded-full px-1 py-px text-[9px] font-bold leading-none text-white shadow",
                isGift ? "bg-amber-600" : "bg-emerald-600",
              )}
            >
              {line.quantity}
            </span>
          </div>
        );
      })}
      {overflow > 0 ? (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
