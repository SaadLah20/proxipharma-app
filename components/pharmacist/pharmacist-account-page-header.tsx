"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

export function PharmacistAccountPageHeader({
  eyebrow = "Espace pharmacien",
  title,
  subtitle,
  backHref = "/dashboard/pharmacien",
  backLabel = "← Tableau de bord",
  pharmacyName,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  pharmacyName?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-3">
        <Link href={backHref} className={p.backLink}>
          {backLabel}
        </Link>
        <header className={p.hero}>
          <p className={p.heroEyebrow}>{eyebrow}</p>
          <h1 className={p.heroTitle}>{title}</h1>
          {subtitle ? <p className={clsx("mt-1.5 max-w-2xl leading-relaxed", p.heroSubtitle)}>{subtitle}</p> : null}
          {pharmacyName?.trim() ? (
            <p className={clsx("mt-2 truncate text-sm font-semibold", p.heroSubtitle)}>{pharmacyName.trim()}</p>
          ) : null}
        </header>
      </div>
      {trailing ? <div className="flex shrink-0 flex-wrap items-center gap-2">{trailing}</div> : null}
    </div>
  );
}
