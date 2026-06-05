"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

export function PatientAccountPageHeader({
  eyebrow,
  title,
  subtitle,
  backHref = "/",
  backLabel,
  trailing,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
}) {
  const t = useTranslations("account");
  const resolvedEyebrow = eyebrow ?? t("patientSpace");
  const resolvedBackLabel = backLabel ?? t("backToDirectory");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link href={backHref} className={clsx(p.backLink, "shrink-0 self-start")}>
          {resolvedBackLabel}
        </Link>
        {trailing ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            {trailing}
          </div>
        ) : null}
      </div>

      <header className={clsx(p.hero, "w-full")}>
        <p className={p.heroEyebrow}>{resolvedEyebrow}</p>
        <h1 className={clsx(p.heroTitle, "break-words text-lg leading-snug sm:text-xl")}>{title}</h1>
        {subtitle ? (
          <p className={clsx("mt-1.5 max-w-2xl break-words leading-relaxed", p.heroSubtitle)}>{subtitle}</p>
        ) : null}
      </header>
    </div>
  );
}
