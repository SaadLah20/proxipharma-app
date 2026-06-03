/**
 * Regroupe les lignes « répondue — à valider » pour l’affichage patient.
 */

import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import {
  isPrescriptionAdditionalProposedLine,
} from "@/lib/prescription-pharmacist-lines";
import type { HubCopyAudience } from "@/lib/hub-copy-audience";
import { isPharmacienCopyAudience } from "@/lib/hub-copy-audience";

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
  const dispoQty =
    row.available_qty != null && Number.isFinite(Number(row.available_qty))
      ? Math.max(0, Math.floor(Number(row.available_qty)))
      : null;
  try {
    return inferAvailabilityStatusFromQty({
      status: row.availability_status ?? "available",
      availableQty: dispoQty ?? 0,
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
      return "Disponibles";
    case "partially_available":
      return "Partiellement disponibles";
    case "to_order":
      return "À commander";
    case "indispo_with_alts":
      return "Indisponibles + alternatives";
    case "indispo_no_alts":
      return "Indisponibles";
  }
}

/** Statut court pour l’onglet « Ta demande » (indispo / rupture). */
export function patientRespondedPrincipalTabStatusFr(row: RespondedLineLike): string | null {
  const eff = principalEffectiveStatus(row);
  if (eff === "unavailable") return "Indisponible";
  if (eff === "market_shortage") return "En rupture";
  return null;
}

/** Libellé complet (accessibilité / info-bulle). */
export function patientRespondedBucketAriaTitleFr(
  id: PatientRespondedBucketId,
  audience: HubCopyAudience = "patient"
): string {
  const ph = isPharmacienCopyAudience(audience);
  switch (id) {
    case "available":
      return "Produits disponibles en officine";
    case "partially_available":
      return "Produits partiellement disponibles";
    case "to_order":
      return ph ? "Produits à commander pour le patient" : "Produits à commander pour vous";
    case "indispo_with_alts":
      return ph
        ? "Indisponible ou en rupture — alternatives proposées au patient"
        : "Produit indisponible ou en rupture — l’officine propose des alternatives";
    case "indispo_no_alts":
      return ph
        ? "Indisponible ou en rupture — sans alternative proposée"
        : "Produit indisponible ou en rupture — sans alternative";
  }
}

export function patientRespondedBucketHeaderBarClass(id: PatientRespondedBucketId): string {
  return cnBucketAccent(id, "header");
}

export function patientRespondedBucketSectionShellClass(id: PatientRespondedBucketId): string {
  return cnBucketAccent(id, "shell");
}

function cnBucketAccent(id: PatientRespondedBucketId, part: "header" | "shell"): string {
  const base =
    part === "header"
      ? "border border-border/80 bg-card shadow-none"
      : "border border-border/80 bg-card shadow-none";
  switch (id) {
    case "available":
      return `${base} border-l-[3px] border-l-emerald-500/85`;
    case "partially_available":
      return `${base} border-l-[3px] border-l-sky-500/80`;
    case "to_order":
      return `${base} border-l-[3px] border-l-teal-600/80`;
    case "indispo_with_alts":
      return `${base} border-l-[3px] border-l-amber-500/80`;
    case "indispo_no_alts":
      return `${base} border-l-[3px] border-l-slate-400/90`;
  }
}

export function patientRespondedBucketAccentTextClass(id: PatientRespondedBucketId): string {
  switch (id) {
    case "available":
      return "text-emerald-700";
    case "partially_available":
      return "text-sky-700";
    case "to_order":
      return "text-teal-700";
    case "indispo_with_alts":
      return "text-amber-800";
    case "indispo_no_alts":
      return "text-slate-600";
  }
}

export function patientRespondedBucketHeaderClass(id: PatientRespondedBucketId): string {
  return patientRespondedBucketAccentTextClass(id);
}

export function patientRespondedBucketCountBadgeClass(_id: PatientRespondedBucketId): string {
  return "bg-muted/50 text-foreground ring-border/60";
}

export function patientRespondedBucketHintFr(
  id: PatientRespondedBucketId,
  audience: HubCopyAudience = "patient"
): string {
  const ph = isPharmacienCopyAudience(audience);
  switch (id) {
    case "available":
      return "Dispo suffisante pour la quantité demandée.";
    case "partially_available":
      return ph
        ? "Dispo partielle — le patient pourra ajuster la quantité retenue."
        : "Dispo partielle — ajustez la quantité retenue si besoin.";
    case "to_order":
      return "Réception prévue par l’officine — date indiquée sur la ligne.";
    case "indispo_with_alts":
      return ph
        ? "Demande initiale indisponible — proposez des alternatives au patient."
        : "Votre demande n’est pas disponible ; l’officine propose d’autres options.";
    case "indispo_no_alts":
      return "Produit non retenable pour l’instant — aucune alternative proposée.";
  }
}
