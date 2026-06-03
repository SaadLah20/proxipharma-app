import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import { isRequestItemAddedAfterPatientConfirmation } from "@/lib/supply-line-post-confirm";
import type { SupplyAmendmentBundle } from "@/lib/product-line-history/types";

/** Parcours narratif d’une ligne — l’historique ne mélange pas les mêmes titres. */
export type ProductLineJourneyKind =
  | "patient_requested"
  | "pharmacist_proposed_in_response"
  | "added_after_confirm"
  /** Ligne saisie par l’officine depuis le scan (ordonnance). */
  | "prescription_pharmacist_sourced";

export function resolveProductLineJourney(
  row: PatientLineLike,
  bundles: SupplyAmendmentBundle[],
  requestType?: string | null
): ProductLineJourneyKind {
  if (isRequestItemAddedAfterPatientConfirmation(row.id, bundles)) {
    return "added_after_confirm";
  }
  if (row.line_source === "pharmacist_proposed") {
    return "pharmacist_proposed_in_response";
  }
  if (requestType === "prescription") {
    return "prescription_pharmacist_sourced";
  }
  return "patient_requested";
}
