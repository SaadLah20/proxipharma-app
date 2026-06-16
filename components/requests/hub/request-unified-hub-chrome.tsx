"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { DemandeHubTabBar, type HubTab, type HubTabAccent } from "@/components/requests/demande-hub-ui";
import { RequestParcoursTabBar } from "@/components/requests/hub/request-parcours-tab-bar";
import { patientConsultationHubDashboardShellClass } from "@/lib/patient-consultation-hub-dashboard-ui";
import { patientPrescriptionHubDashboardShellClass } from "@/lib/patient-prescription-hub-dashboard-ui";
import { patientProductHubDashboardShellClass } from "@/lib/patient-product-hub-dashboard-ui";
import type { RequestHubParcoursSlug } from "@/lib/request-hub-parcours";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";

export type UnifiedHubWorkflowAccent = HubTabAccent | "neutral";

function workflowAccentToHubTab(accent: UnifiedHubWorkflowAccent): HubTabAccent | undefined {
  return accent === "neutral" ? undefined : accent;
}

function bannerShellClass(accent: UnifiedHubWorkflowAccent): string {
  if (accent === "neutral") {
    return clsx(p.hero, "p-0");
  }
  switch (accent) {
    case "sky":
      return patientProductHubDashboardShellClass;
    case "amber":
      return patientPrescriptionHubDashboardShellClass;
    case "violet":
      return patientConsultationHubDashboardShellClass;
    default:
      return patientProductHubDashboardShellClass;
  }
}

function bannerDividerClass(accent: UnifiedHubWorkflowAccent): string {
  if (accent === "neutral") return "border-border/80";
  switch (accent) {
    case "sky":
      return "border-sky-100/55";
    case "amber":
      return "border-amber-100/45";
    case "violet":
      return "border-violet-100/45";
    default:
      return "border-border/80";
  }
}

export function parcoursToWorkflowAccent(parcours: RequestHubParcoursSlug): UnifiedHubWorkflowAccent {
  if (parcours === "produits") return "sky";
  if (parcours === "ordonnances") return "amber";
  if (parcours === "consultations") return "violet";
  return "neutral";
}

export function RequestUnifiedHubChrome({
  parcours,
  parcoursCounts,
  onParcoursChange,
  title,
  workflowAccent,
  tab,
  onTab,
  tabLabels,
}: {
  parcours: RequestHubParcoursSlug;
  parcoursCounts: Record<RequestHubParcoursSlug, number>;
  onParcoursChange: (slug: RequestHubParcoursSlug) => void;
  title: string;
  workflowAccent: UnifiedHubWorkflowAccent;
  tab: HubTab;
  onTab: (t: HubTab) => void;
  tabLabels: { dashboard: string; list: string };
}) {
  const tabAccent = workflowAccentToHubTab(workflowAccent);

  return (
    <div className={clsx("overflow-hidden rounded-2xl border shadow-sm", bannerShellClass(workflowAccent))}>
      <RequestParcoursTabBar
        active={parcours}
        counts={parcoursCounts}
        onChange={onParcoursChange}
        variant="embedded"
      />

      <div className={clsx("border-t px-4 py-2.5 text-center", bannerDividerClass(workflowAccent))}>
        <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">{title}</h1>
      </div>

      <div className={clsx("border-t px-3 pb-2.5 pt-2", bannerDividerClass(workflowAccent))}>
        <DemandeHubTabBar
          tab={tab}
          onTab={onTab}
          tabOrder="listFirst"
          labels={tabLabels}
          variant="embedded"
          accent={tabAccent}
        />
      </div>
    </div>
  );
}

export function HubListScopeCount({
  activeCount,
  totalCount,
  filteredCount,
  activeOnly,
  hasListFilters,
}: {
  activeCount: number;
  totalCount: number;
  filteredCount: number;
  activeOnly: boolean;
  hasListFilters: boolean;
}) {
  const t = useTranslations("hub.listChrome");

  const label = activeOnly
    ? t("scopeCountActive", { active: activeCount, total: totalCount })
    : hasListFilters
      ? t("scopeCountFiltered", { shown: filteredCount, total: totalCount })
      : t("scopeCountTotal", { total: totalCount });

  return (
    <span className="text-[11px] font-semibold tabular-nums text-muted-foreground" aria-live="polite">
      {label}
    </span>
  );
}
