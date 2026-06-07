/**
 * Accents tableau de bord pharmacien — demandes produits (sky, aligné patient).
 */

import type { PatientHubSectionTier } from "@/lib/patient-product-hub-dashboard-ui";
import type { PharmacistProductHubSectionId } from "@/lib/pharmacist-product-hub-sections";

export {
  patientProductHubDashboardShellClass as pharmacistProductHubDashboardShellClass,
  patientProductHubSummaryBarClass as pharmacistProductHubSummaryBarClass,
  patientProductHubRecentSectionClass as pharmacistProductHubRecentSectionClass,
  patientProductHubGroupAccent as pharmacistProductHubGroupAccent,
  patientProductHubSectionShellClass as pharmacistProductHubSectionShellClass,
  patientProductHubSectionBadgeClass as pharmacistProductHubSectionBadgeClass,
} from "@/lib/patient-product-hub-dashboard-ui";

export function pharmacistProductHubSectionTierForId(
  sectionId: PharmacistProductHubSectionId,
): PatientHubSectionTier {
  if (sectionId === "action_required") return "primary";
  if (sectionId === "archives") return "tertiary";
  return "secondary";
}
