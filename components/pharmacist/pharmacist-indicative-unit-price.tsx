"use client";

import { clsx } from "clsx";
import { Pencil } from "lucide-react";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing/types";
import { hasProductPricingOverride } from "@/lib/pharmacy-pricing/price-adjust";

type PharmacistIndicativeUnitPriceProps = {
  label?: string;
  priceLabel: string;
  title?: string;
  canEditPrice: boolean;
  productId?: string | null;
  pricingConfig?: PharmacyPricingConfig | null;
  onEditPrice?: () => void;
  layout?: "inline" | "stacked";
  className?: string;
};

export function PharmacistIndicativeUnitPrice({
  label = "PU indicatif",
  priceLabel,
  title,
  canEditPrice,
  productId,
  pricingConfig,
  onEditPrice,
  layout = "stacked",
  className,
}: PharmacistIndicativeUnitPriceProps) {
  const hasOverride = hasProductPricingOverride(pricingConfig, productId);

  if (layout === "inline") {
    return (
      <p className={clsx("text-[10px] text-muted-foreground", className)}>
        {label}{" "}
        <span className="inline-flex items-center gap-1">
          <span
            className="font-semibold tabular-nums text-foreground"
            title={title}
          >
            {priceLabel}
          </span>
          {hasOverride ? (
            <span className="rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-800">
              Règle produit
            </span>
          ) : null}
          {canEditPrice && onEditPrice ? (
            <button
              type="button"
              onClick={onEditPrice}
              className="inline-flex size-5 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
              aria-label="Ajuster le prix unitaire"
            >
              <Pencil className="size-3" aria-hidden />
            </button>
          ) : null}
        </span>
      </p>
    );
  }

  return (
    <div className={clsx("flex min-w-[5.25rem] flex-col justify-end gap-0.5 text-end sm:min-w-[6rem]", className)}>
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center justify-end gap-1">
        <p
          className="whitespace-nowrap py-2 text-[12px] font-semibold tabular-nums text-foreground"
          title={title}
        >
          {priceLabel}
        </p>
        {canEditPrice && onEditPrice ? (
          <button
            type="button"
            onClick={onEditPrice}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-input bg-background text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
            aria-label="Ajuster le prix unitaire"
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      {hasOverride ? (
        <span className="self-end rounded bg-violet-100 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-800">
          Règle produit
        </span>
      ) : null}
    </div>
  );
}
