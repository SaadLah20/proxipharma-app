import {
  isPrescriptionAdditionalProposedLine,
  isPrescriptionOrdonnancePrincipalLine,
  PRESCRIPTION_ADDITIONAL_PROPOSED_REASON,
  PRESCRIPTION_ORDONNANCE_REASON,
} from "@/lib/prescription-pharmacist-lines";

type LineRow = {
  line_source?: string | null;
  id: string;
  pharmacist_proposal_reason?: string | null;
  patient_chosen_alternative_id?: string | null;
};

/** Badge court patient (validation / validé). */
export function patientPrescriptionLineBadge(
  requestType: string,
  row: LineRow,
  amendmentBundles: { amendments: unknown }[]
): string | null {
  if (requestType !== "prescription" || row.line_source !== "pharmacist_proposed") return null;
  if (
    row.patient_chosen_alternative_id &&
    isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)
  ) {
    return "Ordonnance + alternative";
  }
  if (row.patient_chosen_alternative_id) return "Alternative";
  if (isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)) return "Ordonnance";
  if (isPrescriptionAdditionalProposedLine(requestType, row, amendmentBundles)) {
    return "Produit proposé par la pharmacie";
  }
  return "Ordonnance";
}

/** Libellé détail confirmation patient. */
export function patientPrescriptionChoiceDetail(args: {
  requestType: string;
  row: LineRow;
  amendmentBundles: { amendments: unknown }[];
  branch: "principal" | string;
}): string {
  const { requestType, row, amendmentBundles, branch } = args;
  if (branch !== "principal") return "Alternative";
  if (requestType !== "prescription") {
    if (row.line_source === "pharmacist_proposed") return "Produit proposé par la pharmacie";
    return "Produit demandé initialement";
  }
  if (isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles)) {
    return PRESCRIPTION_ORDONNANCE_REASON;
  }
  if (isPrescriptionAdditionalProposedLine(requestType, row, amendmentBundles)) {
    return PRESCRIPTION_ADDITIONAL_PROPOSED_REASON;
  }
  return PRESCRIPTION_ORDONNANCE_REASON;
}

/** Ajout après validation : canal patient requis (proposition complémentaire), pas saisie ordonnance. */
export function prescriptionLineRequiresPatientConsent(
  requestType: string,
  row: LineRow,
  amendmentBundles: { amendments: unknown }[],
  opts?: { localOnly?: boolean }
): boolean {
  if (requestType !== "prescription") return false;
  if (opts?.localOnly && !row.id.startsWith("local-proposed-")) return false;
  if (row.line_source !== "pharmacist_proposed" && !row.id.startsWith("local-proposed-")) return false;
  return isPrescriptionAdditionalProposedLine(requestType, row, amendmentBundles);
}
