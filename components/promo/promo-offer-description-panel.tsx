"use client";

import { clsx } from "clsx";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";

export function PromoOfferDescriptionPanel({
  description,
  label = "Description du pack",
  className,
}: {
  description: string | null | undefined;
  label?: string;
  className?: string;
}) {
  const text = description?.trim();
  if (!text) return null;

  return (
    <div className={clsx("min-w-0", className)}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={clsx(
          "mt-1.5 w-full break-words rounded-lg border px-2.5 py-2 text-[11px] leading-snug text-foreground/90 sm:text-xs",
          pt.descriptionInset,
        )}
      >
        {text}
      </p>
    </div>
  );
}
