/**
 * Accents tableau de bord pharmacien — ordonnances (amber, aligné patient).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import {
  patientPrescriptionHubDashboardShellClass,
  patientPrescriptionHubGroupActionRequired,
  patientPrescriptionHubGroupArchives,
  patientPrescriptionHubGroupAtPharmacy,
  patientPrescriptionHubRecentSectionClass,
  patientPrescriptionHubSectionBadgeClass,
  patientPrescriptionHubSectionShellClass,
  patientPrescriptionHubSummaryBarClass,
} from "@/lib/patient-prescription-hub-dashboard-ui";
import type { PharmacistProductHubSectionId } from "@/lib/pharmacist-product-hub-sections";

export {
  patientPrescriptionHubDashboardShellClass as pharmacistPrescriptionHubDashboardShellClass,
  patientPrescriptionHubSummaryBarClass as pharmacistPrescriptionHubSummaryBarClass,
  patientPrescriptionHubRecentSectionClass as pharmacistPrescriptionHubRecentSectionClass,
  patientPrescriptionHubSectionShellClass as pharmacistPrescriptionHubSectionShellClass,
  patientPrescriptionHubSectionBadgeClass as pharmacistPrescriptionHubSectionBadgeClass,
};

/** Tuiles statut hub — « Chez l'officine » avant « Chez le client ». */
export function pharmacistPrescriptionHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "at_pharmacy") return patientPrescriptionHubGroupActionRequired;
  if (groupId === "at_patient") return patientPrescriptionHubGroupAtPharmacy;
  return patientPrescriptionHubGroupArchives;
}

export function pharmacistPrescriptionHubSectionTierForId(
  sectionId: PharmacistProductHubSectionId,
): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "awaiting_patient_validation" || sectionId === "awaiting_patient") return "tertiary";
  return "tertiary";
}
