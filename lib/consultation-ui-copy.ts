/** Libellés UI consultation libre (vocabulaire neutre — pas de « proposé par la pharmacie »). */

export const CONSULTATION_QTY_PROPOSED_LABEL = "Qté proposée";

export const CONSULTATION_QTY_PROPOSED_SHORT = "Proposée";

export const CONSULTATION_QTY_RETAINED_LABEL = "Qté retenue";

export function isConsultationRequestType(requestType: string | null | undefined): boolean {
  return requestType === "free_consultation";
}

export function consultationProposedQtyLabelFr(_requestType?: string | null): string {
  return CONSULTATION_QTY_PROPOSED_LABEL;
}

export function consultationRetainedQtyLabelFr(_requestType?: string | null): string {
  return CONSULTATION_QTY_RETAINED_LABEL;
}

export function respondedPrincipalTabLabelFrConsultation(requestType: string | null | undefined): string {
  return isConsultationRequestType(requestType) ? "Produit" : "";
}

export { useConsultationUiCopy } from "@/lib/use-consultation-ui-copy";
