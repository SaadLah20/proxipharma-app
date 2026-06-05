import {
  isPrescriptionOrdonnancePrincipalLine,
  isProductRequestAjoutOfficineLine,
} from "@/lib/prescription-pharmacist-lines";
import { pharmacistProposedProductBadgeFr } from "@/lib/request-display";
import {
  isRequestItemAddedAfterPatientConfirmation,
  POST_CONFIRM_LINE_ADDED_BADGE_FR,
} from "@/lib/supply-line-post-confirm";

type LineRow = {
  line_source?: string | null;
  id: string;
  pharmacist_proposal_reason?: string | null;
};

type AmendmentBundle = { amendments: unknown };

/** Libellé badge « proposé / ordonnance / ajout officine » par ligne (patient). */
export function patientLineProposedBadgeLabel(
  requestType: string,
  row: LineRow,
  amendmentBundles: AmendmentBundle[],
  defaults: { ordonnance: string; proposed: string; officine: string }
): string | null {
  if (isRequestItemAddedAfterPatientConfirmation(row.id, amendmentBundles)) {
    return POST_CONFIRM_LINE_ADDED_BADGE_FR;
  }
  if (requestType === "prescription") {
    if (isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)) {
      return defaults.ordonnance;
    }
    if (row.line_source !== "pharmacist_proposed") return null;
    return defaults.proposed;
  }
  if (row.line_source !== "pharmacist_proposed") return null;
  if (requestType === "free_consultation") {
    return null;
  }
  if (isProductRequestAjoutOfficineLine(requestType, row)) {
    return defaults.officine;
  }
  return defaults.proposed || pharmacistProposedProductBadgeFr;
}
