import type { HistoryActorTone } from "@/lib/request-history-fr";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";

/** Grandes étapes du parcours produit — affichées comme chapitres dans l’historique. */
export type LineHistoryPhase =
  | "origin"
  | "response"
  | "validation"
  | "preparation"
  | "counter"
  | "epilogue";

export type LineEventKind =
  | "origin_patient_request"
  | "origin_patient_request_updated"
  | "origin_pharmacist_proposed"
  | "pharmacist_response"
  | "pharmacist_response_updated_line"
  | "patient_validation_kept"
  | "patient_validation_skipped"
  | "patient_validation_updated"
  | "amend_line_adjust_supply"
  | "amend_validated_qty_change"
  | "amend_withdraw_after_confirm"
  | "amend_line_added_after_confirm"
  | "amend_line_removed_after_confirm"
  | "amend_reintegrate"
  | "amend_line_brought_to_reserve"
  | "amend_other"
  | "legacy_audit_adjustment"
  | "counter_picked_up"
  | "counter_unset"
  | "counter_cancelled"
  | "counter_other"
  | "withdraw_auto_at_closure"
  | "withdraw_inferred"
  | "dossier_line_note"
  | "epilogue_active"
  | "epilogue_archived";

export type DossierHistoryRow = {
  id?: string;
  created_at: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
};

export type SupplyAmendmentBundle = {
  id: string;
  created_at: string;
  amendments: unknown;
};

export type ProductLineHistoryContext = {
  row: PatientLineLike;
  requestCreatedAt: string;
  requestSubmittedAt: string | null;
  requestRespondedAt: string | null;
  requestConfirmedAt: string | null;
  requestStatus?: string | null;
  supplyBundles: SupplyAmendmentBundle[];
  dossierHistory?: DossierHistoryRow[];
  dossierHistoryDetailParagraphs?: (reason: string | null | undefined) => string[];
  pharmacistProposedOriginLabel?: string;
  patientLineOriginLabel?: string;
  requestType?: string | null;
  audience: "patient" | "pharmacist";
};

/** Événement normalisé avant rendu UI. */
export type ProductLineEvent = {
  id: string;
  kind: LineEventKind;
  phase: LineHistoryPhase;
  atIso: string;
  sortKey: number;
  title: string;
  bodyLines: string[];
  actorLabel: string;
  actorTone: HistoryActorTone;
  isCurrent?: boolean;
  isSynthetic?: boolean;
};

export type ProductLineHistoryBlockFr = {
  id: string;
  atIso: string | null;
  atLabel: string;
  title: string;
  body: string;
  actorLabel: string;
  actorTone?: HistoryActorTone;
  isCurrent?: boolean;
  phase?: LineHistoryPhase;
  phaseLabel?: string;
  isPhaseStart?: boolean;
};
