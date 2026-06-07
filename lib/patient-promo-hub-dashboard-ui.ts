/**
 * Accents tableau de bord patient — parcours « packs promo » (emerald discret).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import type { PromoHubSectionId } from "@/lib/promo/reservation-hub-sections";

export type PatientPromoHubDashboardAccent = "emerald";

/** Priorité 1 — passage prévu (confirmée). */
export const patientPromoHubGroupActionRequired: HubDashboardGroupAccent = {
  shell:
    "border-emerald-200/55 bg-gradient-to-br from-emerald-50/45 via-white to-emerald-50/20 ring-1 ring-emerald-100/40",
  label: "text-emerald-950",
  badge: "bg-emerald-700/90 text-white shadow-sm",
};

/** Priorité 2 — en attente officine (soumise). */
export const patientPromoHubGroupAtPharmacy: HubDashboardGroupAccent = {
  shell:
    "border-emerald-200/40 bg-gradient-to-br from-emerald-50/25 via-card to-white ring-1 ring-emerald-100/25",
  label: "text-emerald-900/85",
  badge: "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/45",
};

/** Groupe tuiles « en cours » (dashboard stat). */
export const patientPromoHubGroupEnCours: HubDashboardGroupAccent = {
  shell:
    "border-emerald-200/50 bg-gradient-to-br from-emerald-50/35 via-card to-white ring-1 ring-emerald-100/35",
  label: "text-emerald-950",
  badge: "bg-emerald-600/10 text-emerald-900",
};

/** Archives / historique. */
export const patientPromoHubGroupArchives: HubDashboardGroupAccent = {
  shell: "border-border/55 bg-muted/10 ring-0",
  label: "text-muted-foreground",
  badge: "bg-muted/70 text-muted-foreground",
};

export function patientPromoHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "action_required") return patientPromoHubGroupActionRequired;
  if (groupId === "at_pharmacy") return patientPromoHubGroupAtPharmacy;
  if (groupId === "en_cours" || groupId === "a_suivre") return patientPromoHubGroupEnCours;
  return patientPromoHubGroupArchives;
}

export function patientPromoHubStatGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "en_cours") return patientPromoHubGroupEnCours;
  if (groupId === "a_suivre") {
    return {
      shell:
        "border-emerald-200/50 bg-gradient-to-br from-emerald-50/30 via-card to-white ring-1 ring-emerald-100/30",
      label: "text-emerald-950",
      badge: "bg-emerald-600/10 text-emerald-900",
    };
  }
  return patientPromoHubGroupArchives;
}

export const patientPromoHubDashboardShellClass =
  "border-emerald-200/40 bg-gradient-to-br from-emerald-50/18 via-card to-white ring-1 ring-emerald-100/25";

export const patientPromoHubSummaryBarClass =
  "border-emerald-200/40 bg-emerald-50/25 ring-1 ring-emerald-100/25";

export const patientPromoHubRecentSectionClass =
  "border-emerald-200/45 bg-card ring-1 ring-emerald-100/25";

export function patientPromoHubSectionShellClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "border-emerald-200/50 bg-gradient-to-br from-emerald-50/35 via-card to-white ring-1 ring-emerald-100/35 shadow-sm";
    case "secondary":
      return "border-emerald-200/35 bg-card ring-1 ring-emerald-100/20 shadow-sm";
    case "tertiary":
      return "border-border/60 bg-muted/10 shadow-none";
  }
}

export function patientPromoHubSectionBadgeClass(tier: PatientHubSectionTier): string {
  switch (tier) {
    case "primary":
      return "bg-emerald-700/90 text-white";
    case "secondary":
      return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/40";
    case "tertiary":
      return "bg-muted/80 text-muted-foreground";
  }
}

export function patientPromoHubSectionTierForId(sectionId: PromoHubSectionId): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "at_pharmacy") return "secondary";
  return "tertiary";
}

export function patientPromoHubSectionTitleClass(tier: PatientHubSectionTier): string {
  if (tier === "primary") return "text-[13px] font-bold text-emerald-950";
  if (tier === "secondary") return "text-[13px] font-bold text-foreground";
  return "text-[12px] font-semibold text-muted-foreground";
}

export function patientPromoHubSectionHeaderBorderClass(tier: PatientHubSectionTier): string {
  if (tier === "primary") return "border-emerald-200/45";
  if (tier === "secondary") return "border-emerald-100/35";
  return "border-border/60";
}

export function patientPromoHubListLinkClass(): string {
  return "border-emerald-200/55 text-emerald-950 hover:border-emerald-300/55 hover:bg-emerald-50/40";
}

export function patientPromoHubRecentSectionTitleClass(): string {
  return "text-emerald-950";
}

export function patientPromoHubDashboardAccent(
  role: "patient" | "pharmacien",
): PatientPromoHubDashboardAccent | null {
  return role === "patient" ? "emerald" : null;
}
