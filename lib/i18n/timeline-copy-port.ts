import type { ProductLineJourneyKind } from "@/lib/product-line-history/line-journey";
import type { LineEventKind } from "@/lib/product-line-history/types";
import type { ProductLineHistoryContext } from "@/lib/product-line-history/types";
import type { HistoryViewerRole } from "@/lib/request-history-fr";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

export type TimelineCopyPort = {
  lineEventTitle: (
    kind: LineEventKind,
    audience: "patient" | "pharmacist",
    journey?: ProductLineJourneyKind,
  ) => string;
  dossierPatientHeadline: (oldStatus: string | null, newStatus: string) => string;
  dossierPharmacistHeadline: (oldStatus: string | null, newStatus: string) => string;
  dossierReasonTitle: (reasonKey: string, pharmacist: boolean, productSuffix?: string) => string | null;
  dossierAuditTitle: (multiple: boolean, pharmacist: boolean) => string;
  dossierSameStatusFallback: (pharmacist: boolean) => string;
  dossierOriginTitle: (pharmacist: boolean) => string;
  dossierOriginNote: (pharmacist: boolean, note: string) => string;
  dossierClosureTitle: (pharmacist: boolean) => string;
  dossierFinalStatus: (pharmacist: boolean, statusLabel: string) => string;
  dossierCurrentTitle: (pharmacist: boolean) => string;
  dossierCurrentStatus: (statusLabel: string) => string;
  dossierAwaitingValidation: (pharmacist: boolean) => string;
  actorLabel: (reason: string | null | undefined, viewerRole: HistoryViewerRole) => string;
  actorSummary: (pharmacist: boolean) => string;
  actorToday: (pharmacist: boolean) => string;
  requestStatusLabel: (status: string) => string;
  plannedVisitLine: (dateYmd?: string | null, timePg?: string | null) => string | null;
  summarizeAmendmentEntryLines: (
    entry: SupplyAmendmentEntryJson,
    audience: "patient" | "pharmacist",
  ) => string[];
  buildPatientRequestOriginLines: (ctx: ProductLineHistoryContext, productName: string) => string[];
  buildPharmacistProposedIntroLines: (ctx: ProductLineHistoryContext, productName: string) => string[];
  buildPharmacistResponseLines: (ctx: ProductLineHistoryContext, productName: string) => string[];
  buildValidationKeptLines: (ctx: ProductLineHistoryContext, productName: string) => string[];
  buildValidationSkippedLines: (ctx: ProductLineHistoryContext) => string[];
  amendmentBodyLines: (entry: SupplyAmendmentEntryJson, audience: "patient" | "pharmacist") => string[];
  postConfirmFulfillmentShort: (value: string | null | undefined) => string;
  originRequestedQtyLabel: (ctx: ProductLineHistoryContext) => string;
  counterOutcomeLabel: (outcome: string, cancelReason?: string | null) => string;
  formatDateShort: (iso: string) => string;
  lineBodyText: (key: string, params?: Record<string, string | number>) => string;
};
