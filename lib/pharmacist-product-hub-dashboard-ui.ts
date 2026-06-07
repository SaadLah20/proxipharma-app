/**
 * Accents tableau de bord pharmacien — demandes produits (sky, aligné patient).
 */

import type { HubDashboardGroupAccent, PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import {
  patientProductHubDashboardShellClass,
  patientProductHubGroupActionRequired,
  patientProductHubGroupArchives,
  patientProductHubGroupAtPharmacy,
  patientProductHubRecentSectionClass,
  patientProductHubSectionBadgeClass,
  patientProductHubSectionShellClass,
  patientProductHubSummaryBarClass,
} from "@/lib/patient-product-hub-dashboard-ui";
import type { PharmacistProductHubSectionId } from "@/lib/pharmacist-product-hub-sections";

export {
  patientProductHubDashboardShellClass as pharmacistProductHubDashboardShellClass,
  patientProductHubSummaryBarClass as pharmacistProductHubSummaryBarClass,
  patientProductHubRecentSectionClass as pharmacistProductHubRecentSectionClass,
  patientProductHubSectionShellClass as pharmacistProductHubSectionShellClass,
  patientProductHubSectionBadgeClass as pharmacistProductHubSectionBadgeClass,
};

/** Tuiles statut hub — « Chez l'officine » avant « Chez le client » visuellement. */
export function pharmacistProductHubGroupAccent(groupId: string): HubDashboardGroupAccent {
  if (groupId === "at_pharmacy") return patientProductHubGroupActionRequired;
  if (groupId === "at_patient") return patientProductHubGroupAtPharmacy;
  return patientProductHubGroupArchives;
}

export function pharmacistProductHubSectionTierForId(
  sectionId: PharmacistProductHubSectionId,
): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "awaiting_patient_validation" || sectionId === "awaiting_patient") return "tertiary";
  return "tertiary";
}
