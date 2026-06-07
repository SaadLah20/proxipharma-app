/**
 * Routage charte ligne / dossier patient — produits (sky), ordonnances (amber), consultations (violet).
 */

import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";
import {
  isPatientConsultationRequestType,
  patientConsultationRequestDossierHeaderShellClass,
  patientConsultationRequestDossierSectionShellClass,
  patientConsultationRequestLineCardClass,
} from "@/lib/patient-consultation-request-line-ui";
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

export type PatientWorkflowLineAccent = "sky" | "amber" | "violet";

export function patientWorkflowLineAccent(
  requestType: string | null | undefined,
): PatientWorkflowLineAccent | null {
  if (isPatientProductRequestType(requestType)) return "sky";
  if (isPatientPrescriptionRequestType(requestType)) return "amber";
  if (isPatientConsultationRequestType(requestType)) return "violet";
  return null;
}

export function hasPatientWorkflowAccentShell(requestType: string | null | undefined): boolean {
  return patientWorkflowLineAccent(requestType) !== null;
}

export function patientLineRowClass(requestType: string | null | undefined): string {
  const accent = patientWorkflowLineAccent(requestType);
  if (accent === "sky") return patientProductRequestLineCardClass;
  if (accent === "amber") return patientPrescriptionRequestLineCardClass;
  if (accent === "violet") return patientConsultationRequestLineCardClass;
  return patientBucketProductRowClass;
}

/** Qté / message : accent parcours workflow. */
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
  if (accent === "violet") return patientConsultationRequestDossierSectionShellClass;
  return null;
}

export function patientWorkflowDossierHeaderShellClass(
  requestType: string | null | undefined,
): string | null {
  const accent = patientWorkflowLineAccent(requestType);
  if (accent === "sky") return patientProductRequestDossierHeaderShellClass();
  if (accent === "amber") return patientPrescriptionRequestDossierHeaderShellClass();
  if (accent === "violet") return patientConsultationRequestDossierHeaderShellClass();
  return null;
}

export { isPatientProductRequestType } from "@/lib/patient-product-request-line-ui";
export { isPatientPrescriptionRequestType } from "@/lib/patient-prescription-request-line-ui";
export { isPatientConsultationRequestType } from "@/lib/patient-consultation-request-line-ui";
