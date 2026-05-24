"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Carte blanche type annuaire / fiche officine. */
export const pharmacyPublicCard =
  "rounded-2xl border border-border/90 bg-card text-card-foreground shadow-sm";

export function PharmacyPublicBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-2 hover:underline"
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
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
}) {
  return (
    <header className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-emerald-950 via-emerald-900/95 to-teal-800/90 p-4 text-white shadow-md ring-1 ring-emerald-900/25">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100/90">{eyebrow}</p>
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
