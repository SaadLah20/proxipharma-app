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
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link href={backHref} className={clsx(p.backLink, "shrink-0 self-start")}>
          {backLabel}
        </Link>
        {trailing ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            {trailing}
          </div>
        ) : null}
      </div>

      <header className={clsx(p.hero, "w-full")}>
        <p className={p.heroEyebrow}>{eyebrow}</p>
        <h1 className={clsx(p.heroTitle, "break-words text-lg leading-snug sm:text-xl")}>{title}</h1>
        {subtitle ? (
          <p className={clsx("mt-1.5 max-w-2xl break-words leading-relaxed", p.heroSubtitle)}>{subtitle}</p>
        ) : null}
        {pharmacyName?.trim() ? (
          <p className={clsx("mt-2 break-words text-sm font-semibold", p.heroSubtitle)}>{pharmacyName.trim()}</p>
        ) : null}
      </header>
    </div>
  );
}
