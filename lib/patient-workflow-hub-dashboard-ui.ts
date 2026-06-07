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
import {
  patientConsultationHubDashboardShellClass,
  patientConsultationHubGroupAccent,
  patientConsultationHubRecentSectionClass,
  patientConsultationHubSectionBadgeClass,
  patientConsultationHubSectionShellClass,
  patientConsultationHubSummaryBarClass,
} from "@/lib/patient-consultation-hub-dashboard-ui";
import type { PatientProductHubSectionId } from "@/lib/patient-product-hub-sections";

export type PatientHubDashboardAccent = "sky" | "amber" | "violet";

export function patientHubDashboardAccent(
  kindId: RequestKindId,
  _role: "patient" | "pharmacien",
): PatientHubDashboardAccent | null {
  if (kindId === "product_request") return "sky";
  if (kindId === "prescription") return "amber";
  if (kindId === "free_consultation") return "violet";
  return null;
}

function accentPick<T>(accent: PatientHubDashboardAccent, sky: T, amber: T, violet: T): T {
  if (accent === "sky") return sky;
  if (accent === "amber") return amber;
  return violet;
}

export function patientHubDashboardShellClass(accent: PatientHubDashboardAccent): string {
  return accentPick(
    accent,
    patientProductHubDashboardShellClass,
    patientPrescriptionHubDashboardShellClass,
    patientConsultationHubDashboardShellClass,
  );
}

export function patientHubSummaryBarClass(accent: PatientHubDashboardAccent): string {
  return accentPick(
    accent,
    patientProductHubSummaryBarClass,
    patientPrescriptionHubSummaryBarClass,
    patientConsultationHubSummaryBarClass,
  );
}

export function patientHubRecentSectionClass(accent: PatientHubDashboardAccent): string {
  return accentPick(
    accent,
    patientProductHubRecentSectionClass,
    patientPrescriptionHubRecentSectionClass,
    patientConsultationHubRecentSectionClass,
  );
}

export function patientHubGroupAccent(accent: PatientHubDashboardAccent, groupId: string): HubDashboardGroupAccent {
  if (accent === "sky") return patientProductHubGroupAccent(groupId);
  if (accent === "amber") return patientPrescriptionHubGroupAccent(groupId);
  return patientConsultationHubGroupAccent(groupId);
}

export function patientHubSectionShellClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  return accentPick(
    accent,
    patientProductHubSectionShellClass(tier),
    patientPrescriptionHubSectionShellClass(tier),
    patientConsultationHubSectionShellClass(tier),
  );
}

export function patientHubSectionBadgeClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  return accentPick(
    accent,
    patientProductHubSectionBadgeClass(tier),
    patientPrescriptionHubSectionBadgeClass(tier),
    patientConsultationHubSectionBadgeClass(tier),
  );
}

export function patientHubSectionTierForId(sectionId: PatientProductHubSectionId): PatientHubSectionTier {
  return patientProductHubSectionTierForId(sectionId);
}

export function patientHubSectionTitleClass(accent: PatientHubDashboardAccent, tier: PatientHubSectionTier): string {
  if (tier === "primary") {
    if (accent === "sky") return "text-[13px] font-bold text-sky-950";
    if (accent === "amber") return "text-[13px] font-bold text-amber-950";
    return "text-[13px] font-bold text-violet-950";
  }
  if (tier === "secondary") return "text-[13px] font-bold text-foreground";
  return "text-[12px] font-semibold text-muted-foreground";
}

export function patientHubSectionHeaderBorderClass(
  accent: PatientHubDashboardAccent,
  tier: PatientHubSectionTier,
): string {
  if (tier === "primary") {
    if (accent === "sky") return "border-sky-200/50";
    if (accent === "amber") return "border-amber-200/45";
    return "border-violet-200/45";
  }
  if (tier === "secondary") {
    if (accent === "sky") return "border-sky-100/45";
    if (accent === "amber") return "border-amber-100/35";
    return "border-violet-100/35";
  }
  return "border-border/60";
}

export function patientHubUnreadTextClass(accent: PatientHubDashboardAccent): string {
  if (accent === "sky") return "text-sky-800";
  if (accent === "amber") return "text-amber-900";
  return "text-violet-900";
}

export function patientHubListLinkClass(accent: PatientHubDashboardAccent): string {
  if (accent === "sky") {
    return "border-sky-200/70 text-sky-900 hover:border-sky-300/70 hover:bg-sky-50/50";
  }
  if (accent === "amber") {
    return "border-amber-200/55 text-amber-950 hover:border-amber-300/55 hover:bg-amber-50/40";
  }
  return "border-violet-200/55 text-violet-950 hover:border-violet-300/55 hover:bg-violet-50/40";
}

export function patientHubRecentSectionTitleClass(accent: PatientHubDashboardAccent): string {
  if (accent === "sky") return "text-sky-950";
  if (accent === "amber") return "text-amber-950";
  return "text-violet-950";
}
