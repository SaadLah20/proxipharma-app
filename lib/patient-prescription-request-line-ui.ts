/**
 * Accent amber discret — parcours patient « ordonnance » (tous statuts hub).
 * Opacités plus basses que le sky produits pour ne pas surcharger les pages.
 */

import { prescriptionRequestPublicTheme as t } from "@/lib/request-kinds/prescription-request-public-theme";

/** Contour page / section dossier ordonnance (8 statuts patient). */
export const patientPrescriptionRequestDossierSectionShellClass =
  "border-amber-200/40 bg-gradient-to-br from-amber-50/30 via-white to-orange-50/10 ring-1 ring-amber-100/30";

/** Carte ligne dans un bucket (validée, traitée, archive, répondue…). */
export const patientPrescriptionRequestLineCardClass =
  "w-full min-w-0 rounded-lg border border-amber-200/50 bg-card px-2 py-2.5 shadow-sm ring-1 ring-amber-100/25";

export function isPatientPrescriptionRequestType(requestType: string | null | undefined): boolean {
  return requestType === "prescription";
}

export function patientPrescriptionRequestDossierHeaderShellClass(): string {
  return "rounded-xl border border-amber-200/50 bg-card shadow-sm ring-1 ring-amber-100/30";
}

export { t as patientPrescriptionRequestPublicTheme };
