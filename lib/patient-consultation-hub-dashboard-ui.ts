/**
 * Accents tableau de bord patient — parcours « consultation libre » (violet discret).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";

/** Priorité 1 — action patient. */
export const patientConsultationHubGroupActionRequired: HubDashboardGroupAccent = {
  shell:
    "border-violet-200/55 bg-gradient-to-br from-violet-50/40 via-white to-violet-50/18 ring-1 ring-violet-100/40",
  label: "text-violet-950",
  badge: "bg-violet-700/90 text-white shadow-sm",
};

/** Priorité 2 — suivi côté officine. */
export const patientConsultationHubGroupAtPharmacy: HubDashboardGroupAccent = {
  shell:
    "border-violet-200/40 bg-gradient-to-br from-violet-50/22 via-card to-white ring-1 ring-violet-100/25",
  label: "text-violet-900/85",
  badge: "bg-violet-50 text-violet-900 ring-1 ring-violet-200/45",
};

/** Priorité 3 — archives. */
export const patientConsultationHubGroupArchives: HubDashboardGroupAccent = {
  shell: "border-border/55 bg-muted/10 ring-0",
  label: "text-muted-foreground",
  badge: "bg-muted/70 text-muted-foreground",
};

export function patientConsultationHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "your_action") return patientConsultationHubGroupActionRequired;
  if (groupId === "at_pharmacy") return patientConsultationHubGroupAtPharmacy;
  return patientConsultationHubGroupArchives;
}

export const patientConsultationHubDashboardShellClass =
  "border-violet-200/40 bg-gradient-to-br from-violet-50/16 via-card to-white ring-1 ring-violet-100/25";

export const patientConsultationHubSummaryBarClass =
  "border-violet-200/40 bg-violet-50/22 ring-1 ring-violet-100/25";

export const patientConsultationHubRecentSectionClass =
  "border-violet-200/45 bg-card ring-1 ring-violet-100/25";

export function patientConsultationHubSectionShellClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "border-violet-200/50 bg-gradient-to-br from-violet-50/30 via-card to-white ring-1 ring-violet-100/35 shadow-sm";
    case "secondary":
      return "border-violet-200/35 bg-card ring-1 ring-violet-100/20 shadow-sm";
    case "tertiary":
      return "border-border/60 bg-muted/10 shadow-none";
  }
}

export function patientConsultationHubSectionBadgeClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "bg-violet-700/90 text-white";
    case "secondary":
      return "bg-violet-50 text-violet-900 ring-1 ring-violet-200/40";
    case "tertiary":
      return "bg-muted/80 text-muted-foreground";
  }
}
