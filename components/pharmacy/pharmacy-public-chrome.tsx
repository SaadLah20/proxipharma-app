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
  kindIndicator,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  theme?: "default" | "productRequest";
  embedded?: boolean;
  kindIndicator?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        embedded
          ? "px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
          : "overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-sm sm:p-5",
        theme === "productRequest" && !embedded && "border-l-[3px] border-l-sky-400/50 pl-4"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        {kindIndicator}
      </div>
      <div className="mt-2 flex items-start gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 text-primary"
          aria-hidden
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
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
