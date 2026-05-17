import { isRequestItemAddedAfterPatientConfirmation } from "@/lib/supply-line-post-confirm";

export function isLocalProposedItemId(id: string): boolean {
  return id.startsWith("local-proposed-");
}

export function isPharmacistProposedLine(row: { line_source?: string | null; id: string }): boolean {
  return row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
}

/** Ligne saisie depuis l’ordonnance (principal) — pas un « ajout officine » produit. */
export function isPrescriptionOrdonnancePrincipalLine(
  requestType: string,
  row: { line_source?: string | null; id: string },
  amendmentBundles: { amendments: unknown }[]
): boolean {
  if (requestType !== "prescription") return false;
  if (!isPharmacistProposedLine(row)) return false;
  return !isRequestItemAddedAfterPatientConfirmation(row.id, amendmentBundles);
}

/** Ligne ordonnance saisie par le pharmacien (qté prescrite + qté dispo, règles demande produits). */
export function isPrescriptionOrdonnancePharmacistLine(
  requestType: string,
  row: { line_source?: string | null; id: string }
): boolean {
  return requestType === "prescription" && isPharmacistProposedLine(row);
}

/** Ajout officine : uniquement demande produits, ligne pharmacien hors liste patient initiale. */
export function isProductRequestAjoutOfficineLine(
  requestType: string,
  row: { line_source?: string | null; id: string }
): boolean {
  return requestType === "product_request" && isPharmacistProposedLine(row);
}
