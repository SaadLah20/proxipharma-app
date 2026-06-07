/**
 * Accents tableau de bord pharmacien — consultations libres (violet, aligné patient).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import {
  patientConsultationHubDashboardShellClass,
  patientConsultationHubGroupActionRequired,
  patientConsultationHubGroupArchives,
  patientConsultationHubGroupAtPharmacy,
  patientConsultationHubRecentSectionClass,
  patientConsultationHubSectionBadgeClass,
  patientConsultationHubSectionShellClass,
  patientConsultationHubSummaryBarClass,
} from "@/lib/patient-consultation-hub-dashboard-ui";
import type { PharmacistProductHubSectionId } from "@/lib/pharmacist-product-hub-sections";

export {
  patientConsultationHubDashboardShellClass as pharmacistConsultationHubDashboardShellClass,
  patientConsultationHubSummaryBarClass as pharmacistConsultationHubSummaryBarClass,
  patientConsultationHubRecentSectionClass as pharmacistConsultationHubRecentSectionClass,
  patientConsultationHubSectionShellClass as pharmacistConsultationHubSectionShellClass,
  patientConsultationHubSectionBadgeClass as pharmacistConsultationHubSectionBadgeClass,
};

/** Tuiles statut hub — « Chez l'officine » avant « Chez le client ». */
export function pharmacistConsultationHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "at_pharmacy") return patientConsultationHubGroupActionRequired;
  if (groupId === "at_patient") return patientConsultationHubGroupAtPharmacy;
  return patientConsultationHubGroupArchives;
}

export function pharmacistConsultationHubSectionTierForId(
  sectionId: PharmacistProductHubSectionId,
): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "awaiting_patient_validation" || sectionId === "awaiting_patient") return "tertiary";
  return "tertiary";
}
