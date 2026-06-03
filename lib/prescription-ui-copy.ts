/** Libellés UI ordonnance (alignés demande produits, vocabulaire prescrit / saisi officine). */

export const PRESCRIPTION_PRINCIPAL_TAB_LABEL = "Ordonnance";

export const PRESCRIPTION_PRINCIPAL_BADGE = "Ordonnance";

export const PRESCRIPTION_QTY_PRESCRIBED_LABEL = "Qté prescrite";

export const PRESCRIPTION_QTY_PRESCRIBED_SHORT = "Prescrit";

export function isPrescriptionRequestType(requestType: string | null | undefined): boolean {
  return requestType === "prescription";
}

export function respondedPrincipalTabLabelFr(requestType: string | null | undefined): string {
  return isPrescriptionRequestType(requestType) ? PRESCRIPTION_PRINCIPAL_TAB_LABEL : "Ta demande";
}

export function respondedRequestedQtyLabelFr(requestType: string | null | undefined): string {
  return isPrescriptionRequestType(requestType) ? PRESCRIPTION_QTY_PRESCRIBED_LABEL : "Qté demandée";
}

export function validatedOriginFallbackPatientFr(requestType: string | null | undefined): string {
  return isPrescriptionRequestType(requestType) ? PRESCRIPTION_PRINCIPAL_BADGE : "Ta demande";
}

export function validatedOriginFallbackPharmacistFr(requestType: string | null | undefined): string {
  return isPrescriptionRequestType(requestType) ? PRESCRIPTION_PRINCIPAL_BADGE : "Demande patient";
}

export function archiveClosedQtyLabelFr(requestType: string | null | undefined): string {
  return isPrescriptionRequestType(requestType) ? PRESCRIPTION_QTY_PRESCRIBED_LABEL : "Qté demandée";
}
