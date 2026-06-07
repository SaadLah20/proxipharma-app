import type { RequestKindId } from "@/lib/request-kinds/types";
import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import {
  patientProductHubDashboardShellClass,
  patientProductHubGroupAccent,
  patientProductHubRecentSectionClass,
  patientProductHubSectionBadgeClass,
  patientProductHubSectionShellClass,
  patientProductHubSectionTierForId,
  patientProductHubSummaryBarClass,
} from "@/lib/patient-product-hub-dashboard-ui";
import {
  patientPrescriptionHubDashboardShellClass,
  patientPrescriptionHubGroupAccent,
  patientPrescriptionHubRecentSectionClass,
  patientPrescriptionHubSectionBadgeClass,
  patientPrescriptionHubSectionShellClass,
  patientPrescriptionHubSummaryBarClass,
} from "@/lib/patient-prescription-hub-dashboard-ui";
import type { PatientProductHubSectionId } from "@/lib/patient-product-hub-sections";

export type PatientHubDashboardAccent = "sky" | "amber";

export function patientHubDashboardAccent(
  kindId: RequestKindId,
  role: "patient" | "pharmacien",
): PatientHubDashboardAccent | null {
  if (role !== "patient") return null;
  if (kindId === "product_request") return "sky";
  if (kindId === "prescription") return "amber";
  return null;
}

export function patientHubDashboardShellClass(accent: PatientHubDashboardAccent): string {
  return accent === "sky" ? patientProductHubDashboardShellClass : patientPrescriptionHubDashboardShellClass;
}

export function patientHubSummaryBarClass(accent: PatientHubDashboardAccent): string {
  return accent === "sky" ? patientProductHubSummaryBarClass : patientPrescriptionHubSummaryBarClass;
}

export function patientHubRecentSectionClass(accent: PatientHubDashboardAccent): string {
  return accent === "sky" ? patientProductHubRecentSectionClass : patientPrescriptionHubRecentSectionClass;
}

export function patientHubGroupAccent(accent: PatientHubDashboardAccent, groupId: string): HubDashboardGroupAccent {
  return accent === "sky"
    ? patientProductHubGroupAccent(groupId)
    : patientPrescriptionHubGroupAccent(groupId);
}

export function patientHubSectionShellClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  return accent === "sky"
    ? patientProductHubSectionShellClass(tier)
    : patientPrescriptionHubSectionShellClass(tier);
}

export function patientHubSectionBadgeClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  return accent === "sky"
    ? patientProductHubSectionBadgeClass(tier)
    : patientPrescriptionHubSectionBadgeClass(tier);
}

export function patientHubSectionTierForId(sectionId: PatientProductHubSectionId): PatientHubSectionTier {
  return patientProductHubSectionTierForId(sectionId);
}

export function patientHubSectionTitleClass(accent: PatientHubDashboardAccent, tier: PatientHubSectionTier): string {
  if (tier === "primary") {
    return accent === "sky" ? "text-[13px] font-bold text-sky-950" : "text-[13px] font-bold text-amber-950";
  }
  if (tier === "secondary") return "text-[13px] font-bold text-foreground";
  return "text-[12px] font-semibold text-muted-foreground";
}

export function patientHubSectionHeaderBorderClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  if (tier === "primary") {
    return accent === "sky" ? "border-sky-200/50" : "border-amber-200/45";
  }
  if (tier === "secondary") {
    return accent === "sky" ? "border-sky-100/45" : "border-amber-100/35";
  }
  return "border-border/60";
}

export function patientHubUnreadTextClass(accent: PatientHubDashboardAccent): string {
  return accent === "sky" ? "text-sky-800" : "text-amber-900";
}

export function patientHubListLinkClass(accent: PatientHubDashboardAccent): string {
  return accent === "sky"
    ? "border-sky-200/70 text-sky-900 hover:border-sky-300/70 hover:bg-sky-50/50"
    : "border-amber-200/55 text-amber-950 hover:border-amber-300/55 hover:bg-amber-50/40";
}
