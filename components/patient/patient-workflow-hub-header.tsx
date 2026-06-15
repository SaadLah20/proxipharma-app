"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { DemandeHubTabBar, type HubTab, type HubTabAccent } from "@/components/requests/demande-hub-ui";
import { patientConsultationHubDashboardShellClass } from "@/lib/patient-consultation-hub-dashboard-ui";
import { patientPrescriptionHubDashboardShellClass } from "@/lib/patient-prescription-hub-dashboard-ui";
import { patientProductHubDashboardShellClass } from "@/lib/patient-product-hub-dashboard-ui";
import { patientPromoHubDashboardShellClass } from "@/lib/patient-promo-hub-dashboard-ui";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

export type PatientWorkflowHubAccent = HubTabAccent;

function hubBannerShellClass(accent: PatientWorkflowHubAccent): string {
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

function hubBannerDividerClass(accent: PatientWorkflowHubAccent): string {
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

export function PatientWorkflowHubHeader({
  title,
  accent,
  backHref = "/",
  backLabel,
  tab,
  onTab,
  tabLabels,
}: {
  title: string;
  accent: PatientWorkflowHubAccent;
  backHref?: string;
  backLabel?: string;
  tab: HubTab;
  onTab: (t: HubTab) => void;
  tabLabels: { dashboard: string; list: string };
}) {
  const t = useTranslations("account");
  const resolvedBackLabel = backLabel ?? t("backToDirectory");

  return (
    <div className="space-y-2">
      <Link href={backHref} className={clsx(p.backLink, "inline-block")}>
        {resolvedBackLabel}
      </Link>

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
