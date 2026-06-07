/**
 * Accents tableau de bord patient — parcours « demande de produits » (sky discret).
 */

export type HubDashboardGroupAccent = {
  shell: string;
  label: string;
  badge: string;
};

/** Priorité 1 — action patient (validation, passage comptoir). */
export const patientProductHubGroupActionRequired: HubDashboardGroupAccent = {
  shell:
    "border-sky-300/70 bg-gradient-to-br from-sky-50/95 via-white to-sky-50/55 ring-2 ring-sky-200/55 shadow-sm",
  label: "text-sky-950",
  badge: "bg-sky-600 text-white shadow-sm",
};

/** Priorité 2 — suivi côté officine. */
export const patientProductHubGroupAtPharmacy: HubDashboardGroupAccent = {
  shell:
    "border-sky-200/55 bg-gradient-to-br from-sky-50/40 via-card to-white ring-1 ring-sky-100/45",
  label: "text-sky-900/90",
  badge: "bg-sky-100/95 text-sky-900 ring-1 ring-sky-200/60",
};

/** Priorité 3 — archives (repli visuel). */
export const patientProductHubGroupArchives: HubDashboardGroupAccent = {
  shell: "border-border/55 bg-muted/10 ring-0",
  label: "text-muted-foreground",
  badge: "bg-muted/70 text-muted-foreground",
};

export function patientProductHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "your_action" || groupId === "action_required") {
    return patientProductHubGroupActionRequired;
  }
  if (groupId === "at_pharmacy") {
    return patientProductHubGroupAtPharmacy;
  }
  return patientProductHubGroupArchives;
}

export const patientProductHubDashboardShellClass =
  "border-sky-200/55 bg-gradient-to-br from-sky-50/25 via-card to-white ring-1 ring-sky-100/40";

export const patientProductHubSummaryBarClass =
  "border-sky-200/50 bg-sky-50/35 ring-1 ring-sky-100/35";

export const patientProductHubRecentSectionClass =
  "border-sky-200/55 bg-card ring-1 ring-sky-100/35";

export type PatientHubSectionTier = "primary" | "secondary" | "tertiary";

export function patientProductHubSectionShellClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "border-sky-300/65 bg-gradient-to-br from-sky-50/50 via-card to-white ring-2 ring-sky-200/45 shadow-sm";
    case "secondary":
      return "border-sky-200/50 bg-card ring-1 ring-sky-100/35 shadow-sm";
    case "tertiary":
      return "border-border/60 bg-muted/10 shadow-none";
  }
}

export function patientProductHubSectionBadgeClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "bg-sky-600 text-white";
    case "secondary":
      return "bg-sky-100/90 text-sky-900 ring-1 ring-sky-200/50";
    case "tertiary":
      return "bg-muted/80 text-muted-foreground";
  }
}

export function patientProductHubSectionTierForId(
  sectionId: "action_required" | "at_pharmacy" | "archives",
): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "at_pharmacy") return "secondary";
  return "tertiary";
}
