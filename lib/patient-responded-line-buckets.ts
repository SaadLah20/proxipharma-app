/**
 * Regroupe les lignes « répondue — à valider » pour l’affichage patient.
 */

import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import {
  isPrescriptionAdditionalProposedLine,
} from "@/lib/prescription-pharmacist-lines";

export type PatientRespondedBucketId =
  | "available"
  | "partially_available"
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
    available: [],
    partially_available: [],
    to_order: [],
    indispo_with_alts: [],
    indispo_no_alts: [],
  };

  for (const row of items) {
    const eff = principalEffectiveStatus(row);
    if (eff === "available") {
      out.available.push(row);
      continue;
    }
    if (eff === "partially_available") {
      out.partially_available.push(row);
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
      out.available.push(row);
    } else if (hasRetainableAlternative(row)) {
      out.indispo_with_alts.push(row);
    } else {
      out.indispo_no_alts.push(row);
    }
  }

  return out;
}

export const PATIENT_RESPONDED_BUCKET_ORDER: PatientRespondedBucketId[] = [
  "available",
  "partially_available",
  "to_order",
  "indispo_with_alts",
  "indispo_no_alts",
];

export function patientRespondedBucketTitleFr(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "Disponible";
    case "partially_available":
      return "Partiellement disponible";
    case "to_order":
      return "À commander";
    case "indispo_with_alts":
      return "Indisponible ou en rupture — avec alternative";
    case "indispo_no_alts":
      return "Indisponible ou en rupture";
  }
}

export function patientRespondedBucketHintFr(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "Stock suffisant pour la quantité demandée.";
    case "partially_available":
      return "Stock partiel — ajustez la quantité retenue si besoin.";
    case "to_order":
      return "Réception prévue par l’officine — date indiquée sur la ligne.";
    case "indispo_with_alts":
      return "Votre demande n’est pas disponible ; l’officine propose d’autres options.";
    case "indispo_no_alts":
      return "Produit non retenable pour l’instant — aucune alternative proposée.";
  }
}

/** Enveloppe visuelle des sous-blocs « répondue — à valider » (aligné parité validée sky/teal/ambre). */
export function patientRespondedBucketSectionShellClass(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "border-emerald-400/80 bg-gradient-to-br from-emerald-50/70 via-white to-sky-50/25 ring-emerald-200/60";
    case "partially_available":
      return "border-sky-400/85 bg-gradient-to-br from-sky-50/75 via-white to-amber-50/20 ring-sky-200/65";
    case "to_order":
      return "border-teal-400/85 bg-gradient-to-br from-teal-50/55 via-white to-teal-50/20 ring-teal-200/60";
    case "indispo_with_alts":
      return "border-amber-400/75 bg-gradient-to-br from-amber-50/65 via-white to-violet-50/15 ring-amber-200/55";
    case "indispo_no_alts":
      return "border-slate-300/85 bg-gradient-to-br from-slate-100/75 via-white to-rose-50/20 ring-slate-200/55";
  }
}

export function patientRespondedBucketHeaderClass(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "text-emerald-950";
    case "partially_available":
      return "text-sky-950";
    case "to_order":
      return "text-teal-950";
    case "indispo_with_alts":
      return "text-amber-950";
    case "indispo_no_alts":
      return "text-slate-800";
  }
}

export function patientRespondedBucketIconClass(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "text-emerald-700";
    case "partially_available":
      return "text-sky-700";
    case "to_order":
      return "text-teal-800";
    case "indispo_with_alts":
      return "text-amber-800";
    case "indispo_no_alts":
      return "text-slate-600";
  }
}

export function patientRespondedBucketCountBadgeClass(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "bg-emerald-100/90 text-emerald-950 ring-emerald-200/80";
    case "partially_available":
      return "bg-sky-100/90 text-sky-950 ring-sky-200/80";
    case "to_order":
      return "bg-teal-100/90 text-teal-950 ring-teal-200/80";
    case "indispo_with_alts":
      return "bg-amber-100/90 text-amber-950 ring-amber-200/80";
    case "indispo_no_alts":
      return "bg-slate-100/90 text-slate-800 ring-slate-200/80";
  }
}
