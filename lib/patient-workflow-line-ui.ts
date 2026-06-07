/**
 * Routage charte ligne / dossier patient — demandes produits (sky) et ordonnances (amber).
 */

import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";
import {
  isPatientPrescriptionRequestType,
  patientPrescriptionRequestDossierHeaderShellClass,
  patientPrescriptionRequestDossierSectionShellClass,
  patientPrescriptionRequestLineCardClass,
} from "@/lib/patient-prescription-request-line-ui";
import {
  isPatientProductRequestType,
  patientProductRequestDossierHeaderShellClass,
  patientProductRequestDossierSectionShellClass,
  patientProductRequestLineCardClass,
} from "@/lib/patient-product-request-line-ui";

export type PatientWorkflowLineAccent = "sky" | "amber";

export function patientWorkflowLineAccent(
  requestType: string | null | undefined,
): PatientWorkflowLineAccent | null {
  if (isPatientProductRequestType(requestType)) return "sky";
  if (isPatientPrescriptionRequestType(requestType)) return "amber";
  return null;
}

export function hasPatientWorkflowAccentShell(requestType: string | null | undefined): boolean {
  return patientWorkflowLineAccent(requestType) !== null;
}

export function patientLineRowClass(requestType: string | null | undefined): string {
  const accent = patientWorkflowLineAccent(requestType);
  if (accent === "sky") return patientProductRequestLineCardClass;
  if (accent === "amber") return patientPrescriptionRequestLineCardClass;
  return patientBucketProductRowClass;
}

/** Qté / message : accent parcours ; neutre sur consultation libre. */
export function patientLineQtyAppearance(
  requestType: string | null | undefined,
): "default" | "neutral" {
  return hasPatientWorkflowAccentShell(requestType) ? "default" : "neutral";
}

export function patientWorkflowDossierSectionShellClass(
  requestType: string | null | undefined,
): string | null {
  const accent = patientWorkflowLineAccent(requestType);
  if (accent === "sky") return patientProductRequestDossierSectionShellClass;
  if (accent === "amber") return patientPrescriptionRequestDossierSectionShellClass;
  return null;
}

export function patientWorkflowDossierHeaderShellClass(
  requestType: string | null | undefined,
): string | null {
  const accent = patientWorkflowLineAccent(requestType);
  if (accent === "sky") return patientProductRequestDossierHeaderShellClass();
  if (accent === "amber") return patientPrescriptionRequestDossierHeaderShellClass();
  return null;
}

export { isPatientProductRequestType } from "@/lib/patient-product-request-line-ui";
export { isPatientPrescriptionRequestType } from "@/lib/patient-prescription-request-line-ui";
