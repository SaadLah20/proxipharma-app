/**
 * Accent sky — parcours patient « demande de produits » (tous statuts hub).
 * Référence charte : `lib/request-kinds/product-request-public-theme.ts`.
 */

import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";

/** Contour page / section dossier produit (8 statuts patient). */
export const patientProductRequestDossierSectionShellClass =
  "border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 ring-1 ring-sky-200/55";

/** Carte ligne produit dans un bucket (validée, traitée, archive, répondue…). */
export const patientProductRequestLineCardClass =
  "w-full min-w-0 rounded-lg border border-sky-200/75 bg-card px-2 py-2.5 shadow-sm ring-1 ring-sky-100/45";

export function isPatientProductRequestType(requestType: string | null | undefined): boolean {
  return requestType === "product_request";
}

export function patientLineRowClass(requestType: string | null | undefined): string {
  return isPatientProductRequestType(requestType)
    ? patientProductRequestLineCardClass
    : patientBucketProductRowClass;
}

/** Qté / message : accent sky sur demande produits ; neutre sur ordonnance / consultation. */
export function patientLineQtyAppearance(
  requestType: string | null | undefined,
): "default" | "neutral" {
  return isPatientProductRequestType(requestType) ? "default" : "neutral";
}

export function patientProductRequestDossierHeaderShellClass(): string {
  return `rounded-xl border border-sky-200/70 bg-card shadow-sm ring-1 ring-sky-100/50`;
}

export { t as patientProductRequestPublicTheme };
