/**
 * Regroupe les lignes « répondue — à valider » pour l’affichage patient.
 */

import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import {
  isPrescriptionAdditionalProposedLine,
} from "@/lib/prescription-pharmacist-lines";

export type PatientRespondedBucketId =
  | "dispo"
  | "to_order"
  | "indispo_with_alts"
  | "indispo_no_alts";

export type PatientRespondedLineBuckets<T> = Record<PatientRespondedBucketId, T[]>;

type RespondedLineLike = {
  id: string;
  requested_qty: number;
  availability_status: string | null;
  available_qty: number | null;
  line_source?: string | null;
  request_item_alternatives?:
    | Array<{ id: string; availability_status: string | null; available_qty: number | null }>
    | { id: string; availability_status: string | null; available_qty: number | null }
    | null;
};

function normalizeAlts(
  raw: RespondedLineLike["request_item_alternatives"]
): Array<{ id: string; availability_status: string | null; available_qty: number | null }> {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw] : [raw];
}

function principalEffectiveStatus(row: RespondedLineLike): string {
  const stockQty =
    row.available_qty != null && Number.isFinite(Number(row.available_qty))
      ? Math.max(0, Math.floor(Number(row.available_qty)))
      : null;
  try {
    return inferAvailabilityStatusFromQty({
      status: row.availability_status ?? "available",
      availableQty: stockQty ?? 0,
      requestedQty: Math.max(1, Number(row.requested_qty) || 1),
      isProposedLine: row.line_source === "pharmacist_proposed",
    });
  } catch {
    return row.availability_status ?? "available";
  }
}

function hasRetainableAlternative(row: RespondedLineLike): boolean {
  const alts = normalizeAlts(row.request_item_alternatives);
  return alts.some((alt) => patientMaxQtyAlternative(row, alt) > 0);
}

export function isPatientRespondedAjoutOfficineLine(
  row: RespondedLineLike,
  requestType: string,
  supplyAmendmentBundles: { amendments: unknown }[]
): boolean {
  if (requestType === "prescription") {
    return isPrescriptionAdditionalProposedLine(requestType, row, supplyAmendmentBundles);
  }
  if (requestType === "free_consultation") {
    return row.line_source === "pharmacist_proposed";
  }
  return row.line_source === "pharmacist_proposed";
}

export function bucketPatientRespondedLines<T extends RespondedLineLike>(
  items: T[],
  requestType: string,
  supplyAmendmentBundles: { amendments: unknown }[] = []
): PatientRespondedLineBuckets<T> {
  const out: PatientRespondedLineBuckets<T> = {
    dispo: [],
    to_order: [],
    indispo_with_alts: [],
    indispo_no_alts: [],
  };

  for (const row of items) {
    const eff = principalEffectiveStatus(row);
    if (eff === "available" || eff === "partially_available") {
      out.dispo.push(row);
      continue;
    }
    if (eff === "to_order") {
      out.to_order.push(row);
      continue;
    }
    if (eff === "unavailable" || eff === "market_shortage") {
      if (hasRetainableAlternative(row)) {
        out.indispo_with_alts.push(row);
      } else {
        out.indispo_no_alts.push(row);
      }
      continue;
    }

    if (patientMaxQtyPrincipal(row) > 0) {
      out.dispo.push(row);
    } else if (hasRetainableAlternative(row)) {
      out.indispo_with_alts.push(row);
    } else {
      out.indispo_no_alts.push(row);
    }
  }

  return out;
}

export const PATIENT_RESPONDED_BUCKET_ORDER: PatientRespondedBucketId[] = [
  "dispo",
  "to_order",
  "indispo_with_alts",
  "indispo_no_alts",
];

export function patientRespondedBucketTitleFr(id: PatientRespondedBucketId): string {
  switch (id) {
    case "dispo":
      return "Disponible ou partiellement disponible";
    case "to_order":
      return "À commander";
    case "indispo_with_alts":
      return "Indisponible ou en rupture — avec alternative";
    case "indispo_no_alts":
      return "Indisponible ou en rupture";
  }
}
