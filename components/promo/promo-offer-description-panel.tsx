"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { Package } from "lucide-react";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";
import { cn } from "@/lib/utils";

/** Libellés de section (« Description du pack », « Contenu du pack », etc.). */
export const promoPackMetaLabelClass =
  "text-[10px] font-bold uppercase tracking-wide text-muted-foreground";

/**
 * Carte dossier : bandeau titre, description optionnelle, puis contenu produits.
 */
export function PromoOfferPackDossierSection({
  title,
  description,
  descriptionLabel = "Description du pack",
  kindLabel = "Pack promo",
  discountPercent = 0,
  children,
  className,
}: {
  title: string;
  description?: string | null;
  descriptionLabel?: string;
  kindLabel?: string;
  discountPercent?: number;
  children: ReactNode;
  className?: string;
}) {
  const desc = description?.trim();
  const titleText = title.trim();

  return (
    <section
      className={clsx(
        "w-full min-w-0 overflow-hidden rounded-xl border border-emerald-200/60 bg-card shadow-sm ring-1 ring-emerald-100/35",
        className,
      )}
    >
      <div className={clsx("relative border-b border-emerald-200/40 px-3 py-3.5 sm:px-4 sm:py-4", pt.bannerGradient)}>
        <div
          className={cn("pointer-events-none absolute -right-5 -top-5 size-24 rounded-full blur-2xl", pt.bannerOrb)}
          aria-hidden
        />
        <div className="relative flex items-start gap-3">
          <div className="relative shrink-0" aria-hidden>
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-xl text-white shadow-md sm:size-12",
                pt.iconBadge,
                pt.iconRing,
              )}
            >
              <Package className="size-5 sm:size-[1.35rem]" strokeWidth={2.25} />
            </span>
            {discountPercent > 0 ? (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-none tabular-nums shadow-sm ring-2 ring-white",
                  pt.discountBadge,
                )}
              >
                −{discountPercent}%
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80">{kindLabel}</p>
            <h3 className="mt-0.5 text-base font-bold leading-snug text-foreground [overflow-wrap:anywhere] sm:text-lg">
              {titleText}
            </h3>
          </div>
        </div>
      </div>

      {desc ? (
        <div className="border-b border-emerald-200/35 bg-emerald-50/20 px-3 py-3 sm:px-4">
          <p className={promoPackMetaLabelClass}>{descriptionLabel}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 [overflow-wrap:anywhere]">{desc}</p>
        </div>
      ) : null}

      <div className="px-3 py-3 sm:px-4 sm:py-3.5">{children}</div>
    </section>
  );
}
