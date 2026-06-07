/**
 * Accents tableau de bord patient — parcours « ordonnance » (amber discret).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";

/** Priorité 1 — action patient. */
export const patientPrescriptionHubGroupActionRequired: HubDashboardGroupAccent = {
  shell:
    "border-amber-200/55 bg-gradient-to-br from-amber-50/45 via-white to-amber-50/20 ring-1 ring-amber-100/40",
  label: "text-amber-950",
  badge: "bg-amber-700/90 text-white shadow-sm",
};

/** Priorité 2 — suivi côté officine. */
export const patientPrescriptionHubGroupAtPharmacy: HubDashboardGroupAccent = {
  shell:
    "border-amber-200/40 bg-gradient-to-br from-amber-50/25 via-card to-white ring-1 ring-amber-100/25",
  label: "text-amber-900/85",
  badge: "bg-amber-50 text-amber-900 ring-1 ring-amber-200/45",
};

/** Priorité 3 — archives. */
export const patientPrescriptionHubGroupArchives: HubDashboardGroupAccent = {
  shell: "border-border/55 bg-muted/10 ring-0",
  label: "text-muted-foreground",
  badge: "bg-muted/70 text-muted-foreground",
};

export function patientPrescriptionHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "your_action") return patientPrescriptionHubGroupActionRequired;
  if (groupId === "at_pharmacy") return patientPrescriptionHubGroupAtPharmacy;
  return patientPrescriptionHubGroupArchives;
}

export const patientPrescriptionHubDashboardShellClass =
  "border-amber-200/40 bg-gradient-to-br from-amber-50/18 via-card to-white ring-1 ring-amber-100/25";

export const patientPrescriptionHubSummaryBarClass =
  "border-amber-200/40 bg-amber-50/25 ring-1 ring-amber-100/25";

export const patientPrescriptionHubRecentSectionClass =
  "border-amber-200/45 bg-card ring-1 ring-amber-100/25";

export function patientPrescriptionHubSectionShellClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "border-amber-200/50 bg-gradient-to-br from-amber-50/35 via-card to-white ring-1 ring-amber-100/35 shadow-sm";
    case "secondary":
      return "border-amber-200/35 bg-card ring-1 ring-amber-100/20 shadow-sm";
    case "tertiary":
      return "border-border/60 bg-muted/10 shadow-none";
  }
}

export function patientPrescriptionHubSectionBadgeClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "bg-amber-700/90 text-white";
    case "secondary":
      return "bg-amber-50 text-amber-900 ring-1 ring-amber-200/40";
    case "tertiary":
      return "bg-muted/80 text-muted-foreground";
  }
}
