/**
 * Accent sky — parcours patient « demande de produits » (tous statuts hub).
 * Référence charte : `lib/request-kinds/product-request-public-theme.ts`.
 * Routage multi-parcours : `lib/patient-workflow-line-ui.ts`.
 */

import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";

/** Contour page / section dossier produit (8 statuts patient). */
export const patientProductRequestDossierSectionShellClass =
  "border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 ring-1 ring-sky-200/55";

/** Carte ligne produit dans un bucket (validée, traitée, archive, répondue…). */
export const patientProductRequestLineCardClass =
  "w-full min-w-0 rounded-lg border border-sky-200/75 bg-card px-2 py-2.5 shadow-sm ring-1 ring-sky-100/45";

export function isPatientProductRequestType(requestType: string | null | undefined): boolean {
  return requestType === "product_request";
}

export function patientProductRequestDossierHeaderShellClass(): string {
  return "rounded-xl border border-sky-200/70 bg-card shadow-sm ring-1 ring-sky-100/50";
}

export { t as patientProductRequestPublicTheme };

export {
  hasPatientWorkflowAccentShell,
  isPatientConsultationRequestType,
  isPatientPrescriptionRequestType,
  patientLineQtyAppearance,
  patientLineRowClass,
  patientWorkflowDossierHeaderShellClass,
  patientWorkflowDossierSectionShellClass,
  patientWorkflowLineAccent,
  type PatientWorkflowLineAccent,
} from "@/lib/patient-workflow-line-ui";
