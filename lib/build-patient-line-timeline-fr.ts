/**
 * Historique produit — façade de compatibilité.
 * Implémentation : lib/product-line-history/
 */
import { buildProductLineHistoryBlocksFr } from "@/lib/product-line-history/build-line-history-blocks-fr";
import { amendmentsForLine } from "@/lib/product-line-history/collect-line-events";
import {
  lineEventBadgeLabel,
  supplyAmendmentKindToLineEventKind,
} from "@/lib/product-line-history/line-event-labels-fr";
import { normalizedProductTokensForTimeline } from "@/lib/product-line-history/product-matching";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import type { HistoryActorTone } from "@/lib/request-history-fr";
import type { LineHistoryPhase } from "@/lib/product-line-history/types";

export { normalizedProductTokensForTimeline };

export type PatientLineTimelineBlockFr = {
  id: string;
  atIso: string | null;
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  actorTone?: HistoryActorTone;
  isCurrent?: boolean;
  /** Chapitre narratif (refonte historique). */
  phase?: LineHistoryPhase;
  phaseLabel?: string;
  isPhaseStart?: boolean;
};

export type PatientLineTimelineInputs = {
  row: PatientLineLike;
  requestCreatedAt: string;
  requestSubmittedAt: string | null;
  requestRespondedAt: string | null;
  requestConfirmedAt: string | null;
  requestStatus?: string | null;
  supplyBundles: { id: string; created_at: string; amendments: unknown }[];
  dossierHistory?: { id?: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
  dossierHistoryDetailParagraphs?: (reason: string | null | undefined) => string[];
  pharmacistProposedOriginLabel?: string;
  patientLineOriginLabel?: string;
  timelineAudience?: "patient" | "pharmacist";
};

/** Entrées `request_supply_amendments` concernant cette ligne. */
export function amendmentsForPatientLine(
  row: PatientLineLike,
  bundles: { id: string; created_at: string; amendments: unknown }[]
): { created_at: string; entry: SupplyAmendmentEntryJson }[] {
  return amendmentsForLine(row.id, bundles);
}

/** Libellés courts sur la carte produit — alignés sur l’historique unifié. */
export function postConfirmSupplyAmendmentBadgeLabelsFr(
  row: PatientLineLike,
  bundles: { id: string; created_at: string; amendments: unknown }[]
): string[] {
  const list = amendmentsForPatientLine(row, bundles);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { entry } of list) {
    const eventKind = supplyAmendmentKindToLineEventKind(entry.kind);
    if (seen.has(eventKind)) continue;
    const lab = lineEventBadgeLabel(eventKind);
    if (!lab) continue;
    seen.add(eventKind);
    out.push(lab);
  }
  return out;
}

/** Chronologie narrative du plus ancien au plus récent. */
export function buildPatientLineTimelineFr(input: PatientLineTimelineInputs): PatientLineTimelineBlockFr[] {
  return buildProductLineHistoryBlocksFr({
    row: input.row,
    requestCreatedAt: input.requestCreatedAt,
    requestSubmittedAt: input.requestSubmittedAt,
    requestRespondedAt: input.requestRespondedAt,
    requestConfirmedAt: input.requestConfirmedAt,
    requestStatus: input.requestStatus,
    supplyBundles: input.supplyBundles,
    dossierHistory: input.dossierHistory,
    dossierHistoryDetailParagraphs: input.dossierHistoryDetailParagraphs,
    pharmacistProposedOriginLabel: input.pharmacistProposedOriginLabel,
    patientLineOriginLabel: input.patientLineOriginLabel,
    audience: input.timelineAudience === "pharmacist" ? "pharmacist" : "patient",
  });
}
