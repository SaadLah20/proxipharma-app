"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { productRequestPublicTheme } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

/** Carte blanche type annuaire / fiche officine. */
export const pharmacyPublicCard =
  "rounded-2xl border border-border/90 bg-card text-card-foreground shadow-sm";

export function PharmacyPublicBackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline",
        className
      )}
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

export function PharmacyFlowHero({
  eyebrow,
  title,
  subtitle,
  icon: Icon,
  theme = "default",
  embedded = false,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  /** Parcours demande de produits : accent sky (aligné hubs / détail dossier). */
  theme?: "default" | "productRequest";
  /** Intégré dans une carte header+recherche (sans bordure externe). */
  embedded?: boolean;
}) {
  const isProduct = theme === "productRequest";
  return (
    <header
      className={cn(
        "text-white",
        embedded
          ? "px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
          : "overflow-hidden rounded-2xl border p-4 shadow-md ring-1",
        isProduct
          ? cn(
              productRequestPublicTheme.headerGradient,
              !embedded &&
                cn(
                  "overflow-hidden rounded-2xl border p-4 shadow-md ring-1",
                  productRequestPublicTheme.headerBorder
                )
            )
          : embedded
            ? ""
            : "overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-950 via-emerald-900/95 to-teal-800/90 p-4 shadow-md ring-1 ring-emerald-900/25"
      )}
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.2em]",
          isProduct ? productRequestPublicTheme.headerEyebrow : "text-emerald-100/90"
        )}
      >
        {eyebrow}
      </p>
      {isProduct ? (
        <div className="mt-2 flex items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 shadow-inner backdrop-blur-sm"
            aria-hidden
          >
            <Icon className="size-5 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-tight tracking-tight sm:text-xl">{title}</h1>
            {subtitle ? (
              <p className={cn("mt-1 max-w-prose text-xs leading-snug", productRequestPublicTheme.headerSubtitle)}>
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/15 shadow-inner backdrop-blur-sm"
            aria-hidden
          >
            <Icon className="size-5 text-white" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold leading-snug tracking-tight sm:text-xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-xs leading-snug text-emerald-50/95">{subtitle}</p> : null}
          </div>
        </div>
      )}
    </header>
  );
}

export function PharmacyPublicSectionTitle({
  title,
  hint,
  className,
}: {
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Bloc titre + contenu dans une carte type fiche / annuaire. */
export function PharmacyPublicInfoBlock({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(pharmacyPublicCard, "p-3 sm:p-4", className)}>
      <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function PharmacyPublicEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn(pharmacyPublicCard, "border-dashed bg-muted/10 p-6 text-center text-sm text-muted-foreground")}>
      {children}
    </p>
  );
}
