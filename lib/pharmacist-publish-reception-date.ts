import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import {
  isPrescriptionAdditionalProposedLine,
  isPrescriptionOrdonnancePrincipalLine,
  isProductRequestAjoutOfficineLine,
} from "@/lib/prescription-pharmacist-lines";
import { ordonnanceDraftRequestedQty } from "@/lib/prescription-ordonnance-line-qty";

export const PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR =
  "Saisissez la date de réception prévue pour chaque produit à commander avant d'envoyer la réponse au patient.";

export type PharmacistPublishReceptionDraft = {
  availability_status: string;
  available_qty: string;
  expected_availability_date: string;
  requested_qty_str?: string;
};

export type PharmacistPublishReceptionRow = {
  id: string;
  requested_qty: number;
  line_source?: string | null;
  patient_chosen_alternative_id?: string | null;
  selected_qty?: number | null;
  products?: { name: string } | { name: string }[] | null;
};

function productNameFromRow(row: PharmacistPublishReceptionRow): string {
  const p = row.products;
  if (Array.isArray(p)) return p[0]?.name?.trim() || "Produit";
  return p?.name?.trim() || "Produit";
}

function inferRequestedQtyForPublish(row: PharmacistPublishReceptionRow): number {
  if (row.patient_chosen_alternative_id) {
    return Math.min(
      999,
      Math.max(1, Math.floor(Number(row.selected_qty ?? row.requested_qty) || 1))
    );
  }
  return row.requested_qty;
}

/** Statut dispo inféré à l'envoi (aligné modale de confirmation). */
export function inferredAvailabilityForPharmacistPublish(
  row: PharmacistPublishReceptionRow,
  fd: PharmacistPublishReceptionDraft,
  requestType: string | null | undefined,
  amendmentBundles: { amendments: unknown }[] = []
): string {
  const ordonnancePrincipal =
    requestType === "prescription" &&
    isPrescriptionOrdonnancePrincipalLine(requestType, row, amendmentBundles);
  const additionalProposed =
    requestType === "prescription" &&
    isPrescriptionAdditionalProposedLine(requestType, row, amendmentBundles);
  const requestedQtyForInfer = ordonnancePrincipal
    ? ordonnanceDraftRequestedQty(row, fd)
    : inferRequestedQtyForPublish(row);
  try {
    return inferAvailabilityStatusFromQty({
      status: fd.availability_status,
      availableQty: Number(fd.available_qty || "0"),
      requestedQty: requestedQtyForInfer,
      isProposedLine:
        additionalProposed ||
        (requestType === "product_request" && isProductRequestAjoutOfficineLine(requestType, row)) ||
        requestType === "free_consultation",
    });
  } catch {
    return fd.availability_status;
  }
}

/** Noms des lignes « à commander » sans date de réception prévue. */
export function pharmacistPublishMissingReceptionDateProductNames(
  rows: PharmacistPublishReceptionRow[],
  draft: Record<string, PharmacistPublishReceptionDraft | undefined>,
  requestType: string | null | undefined,
  amendmentBundles: { amendments: unknown }[] = []
): string[] {
  const names: string[] = [];
  for (const row of rows) {
    const fd = draft[row.id];
    if (!fd?.availability_status) continue;
    const inferred = inferredAvailabilityForPharmacistPublish(row, fd, requestType, amendmentBundles);
    if (inferred === "to_order" && !(fd.expected_availability_date ?? "").trim()) {
      names.push(productNameFromRow(row));
    }
  }
  return names;
}

export function pharmacistPublishBlockedMissingReceptionDate(
  rows: PharmacistPublishReceptionRow[],
  draft: Record<string, PharmacistPublishReceptionDraft | undefined>,
  requestType: string | null | undefined,
  amendmentBundles: { amendments: unknown }[] = []
): boolean {
  return pharmacistPublishMissingReceptionDateProductNames(rows, draft, requestType, amendmentBundles).length > 0;
}
