"use client";

import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { DemandeHubTabBar, type HubTab, type HubTabAccent } from "@/components/requests/demande-hub-ui";
import { patientConsultationHubDashboardShellClass } from "@/lib/patient-consultation-hub-dashboard-ui";
import { patientPrescriptionHubDashboardShellClass } from "@/lib/patient-prescription-hub-dashboard-ui";
import { patientProductHubDashboardShellClass } from "@/lib/patient-product-hub-dashboard-ui";
import { patientPromoHubDashboardShellClass } from "@/lib/patient-promo-hub-dashboard-ui";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

export type PharmacistWorkflowHubAccent = HubTabAccent;

function hubBannerShellClass(accent: PharmacistWorkflowHubAccent): string {
  switch (accent) {
    case "sky":
      return patientProductHubDashboardShellClass;
    case "amber":
      return patientPrescriptionHubDashboardShellClass;
    case "violet":
      return patientConsultationHubDashboardShellClass;
    case "emerald":
      return patientPromoHubDashboardShellClass;
  }
}

function hubBannerDividerClass(accent: PharmacistWorkflowHubAccent): string {
  switch (accent) {
    case "sky":
      return "border-sky-100/55";
    case "amber":
      return "border-amber-100/45";
    case "violet":
      return "border-violet-100/45";
    case "emerald":
      return "border-emerald-100/45";
  }
}

export function PharmacistWorkflowHubHeader({
  title,
  accent,
  backHref = "/dashboard/pharmacien",
  backLabel = "← Tableau de bord",
  trailing,
  tab,
  onTab,
  tabLabels,
}: {
  title: string;
  accent: PharmacistWorkflowHubAccent;
  backHref?: string;
  backLabel?: string;
  trailing?: ReactNode;
  tab: HubTab;
  onTab: (t: HubTab) => void;
  tabLabels: { dashboard: string; list: string };
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Link href={backHref} className={clsx(p.backLink, "inline-block shrink-0 self-start")}>
          {backLabel}
        </Link>
        {trailing ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:justify-end">
            {trailing}
          </div>
        ) : null}
      </div>

      <div className={clsx("overflow-hidden rounded-2xl border shadow-sm", hubBannerShellClass(accent))}>
        <div className="px-4 pt-3 pb-2.5">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{title}</h1>
        </div>
        <div className={clsx("border-t px-3 pb-2.5 pt-2", hubBannerDividerClass(accent))}>
          <DemandeHubTabBar
            tab={tab}
            onTab={onTab}
            tabOrder="listFirst"
            labels={tabLabels}
            variant="embedded"
            accent={accent}
          />
        </div>
      </div>
    </div>
  );
}
