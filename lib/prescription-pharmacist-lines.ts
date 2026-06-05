import { isRequestItemAddedAfterPatientConfirmation } from "@/lib/supply-line-post-confirm";

/** Motif historique des anciennes lignes ordonnance en `pharmacist_proposed` (legacy). */
export const PRESCRIPTION_ORDONNANCE_REASON = "Saisie depuis ordonnance";

/** Libellé patient / historique pour une ligne saisie depuis le scan. */
export const PRESCRIPTION_ORDONNANCE_SOURCING_LABEL = "Ordonnance";

export const PRESCRIPTION_ADDITIONAL_PROPOSED_REASON = "Produit proposé par la pharmacie";

export function isLocalProposedItemId(id: string): boolean {
  return id.startsWith("local-proposed-");
}

function ordonnanceReasonMatches(reason: string | null | undefined): boolean {
  const r = (reason ?? "").trim();
  return r === PRESCRIPTION_ORDONNANCE_REASON || r.startsWith("Saisie depuis ordonnance");
}

export function isPharmacistProposedLine(row: { line_source?: string | null; id: string }): boolean {
  return row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
}

/** Ligne saisie depuis l’ordonnance (équivalent « demandé » patient) — pas une proposition complémentaire. */
export function isPrescriptionOrdonnancePrincipalLine(
  requestType: string,
  row: { line_source?: string | null; id: string; pharmacist_proposal_reason?: string | null },
  amendmentBundles: { amendments: unknown }[]
): boolean {
  if (requestType !== "prescription") return false;
  if (isRequestItemAddedAfterPatientConfirmation(row.id, amendmentBundles)) return false;
  if (row.line_source === "patient_request") return true;
  if (!isPharmacistProposedLine(row)) return false;
  return ordonnanceReasonMatches(row.pharmacist_proposal_reason);
}

/** Proposition pharmacien en plus des produits ordonnance (même logique que demande produits). */
export function isPrescriptionAdditionalProposedLine(
  requestType: string,
  row: { line_source?: string | null; id: string; pharmacist_proposal_reason?: string | null },
  amendmentBundles: { amendments: unknown }[]
): boolean {
  return (
    requestType === "prescription" &&
    isPharmacistProposedLine(row) &&
    !isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)
  );
}

/** Ligne ordonnance saisie par le pharmacien (qté prescrite + qté dispo). */
export function isPrescriptionOrdonnancePharmacistLine(
  requestType: string,
  row: { line_source?: string | null; id: string; pharmacist_proposal_reason?: string | null },
  amendmentBundles: { amendments: unknown }[] = []
): boolean {
  return isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles);
}

/**
 * Flag « proposé » pour l’inférence `partially_available` — les lignes ordonnance principales
 * restent des lignes patient (qté prescrite vs dispo), pas des propositions officine.
 */
export function isProposedLineForAvailabilityInference(
  requestType: string,
  row: { line_source?: string | null; id: string; pharmacist_proposal_reason?: string | null },
  amendmentBundles: { amendments: unknown }[],
  opts?: { isAjoutOfficineLine?: boolean; isPrescriptionExtraProposed?: boolean }
): boolean {
  if (requestType === "free_consultation") return true;
  if (opts?.isAjoutOfficineLine) return true;
  if (opts?.isPrescriptionExtraProposed) return true;
  if (isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)) return false;
  return isPharmacistProposedLine(row);
}

/** Ajout officine : uniquement demande produits, ligne pharmacien hors liste patient initiale. */
export function isProductRequestAjoutOfficineLine(
  requestType: string,
  row: { line_source?: string | null; id: string }
): boolean {
  return requestType === "product_request" && isPharmacistProposedLine(row);
}
