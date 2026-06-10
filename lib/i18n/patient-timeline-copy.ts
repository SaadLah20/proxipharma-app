"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDateForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import type { TimelineCopyPort } from "@/lib/i18n/timeline-copy-port";
import { patientRequestStatusBadgeKey } from "@/lib/i18n/patient-request-status-label";
import {
  altRowsOf,
  validatedProductLabel,
} from "@/lib/patient-confirmed-line-buckets";
import { resolveProductLineJourney } from "@/lib/product-line-history/line-journey";
import type { ProductLineHistoryContext } from "@/lib/product-line-history/types";
import type { LineEventKind } from "@/lib/product-line-history/types";
import type { ProductLineJourneyKind } from "@/lib/product-line-history/line-journey";
import { availabilityStatusFr, counterOutcomePatientLabel } from "@/lib/request-display";
import { historyActorToneFromReason, type HistoryViewerRole } from "@/lib/request-history-fr";
import type { SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";

function statusPairKey(oldStatus: string | null, newStatus: string): string {
  const o = (oldStatus ?? "").trim();
  const n = newStatus.trim();
  if (!o) return n;
  return `${o}_to_${n}`;
}

function oneProdAlt(p: unknown): { name?: string | null } | undefined {
  if (!p) return undefined;
  return Array.isArray(p) ? (p[0] as { name?: string | null }) : (p as { name?: string | null });
}

function splitAmendmentDetailFacts(detail: string): string[] {
  const raw = detail.trim();
  if (!raw) return [];
  const withoutProductPrefix = raw.includes(" — ")
    ? raw.slice(raw.indexOf(" — ") + 3).trim() || raw
    : raw;
  return withoutProductPrefix
    .split(/\s*[·•]\s*|\s+—\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function usePatientTimelineCopy(): TimelineCopyPort {
  const locale = useLocale() as AppLocale;
  const tEvents = useTranslations("timeline.events");
  const tSupply = useTranslations("demandes.supplyAmendment");
  const tStatus = useTranslations("demandes.statusBadges");
  const tCommon = useTranslations("common");

  const formatDateShort = useCallback(
    (iso: string) =>
      formatDateForLocale(iso, locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [locale],
  );

  const lineEventTitle = useCallback(
    (
      kind: LineEventKind,
      audience: "patient" | "pharmacist",
      journey: ProductLineJourneyKind = "patient_requested",
    ) => {
      const base = `line.${kind}`;
      const audienceKey = audience === "pharmacist" ? "pharmacist" : "patient";
      const journeyKey = `${base}.${audienceKey}.${journey}`;
      if (tEvents.has(journeyKey)) return tEvents(journeyKey);
      const audienceSimpleKey = `${base}.${audienceKey}`;
      if (tEvents.has(audienceSimpleKey)) return tEvents(audienceSimpleKey);
      return tEvents(`line.fallback.${audienceKey}`);
    },
    [tEvents],
  );

  const dossierPatientHeadline = useCallback(
    (oldStatus: string | null, newStatus: string): string => {
      const key = statusPairKey(oldStatus, newStatus);
      if (tEvents.has(`dossier.historyPatient.${key}`)) return tEvents(`dossier.historyPatient.${key}`);
      if (!oldStatus && tEvents.has(`dossier.historyPatient.${newStatus}`)) {
        return tEvents(`dossier.historyPatient.${newStatus}`);
      }
      if (newStatus === "cancelled" && tEvents.has("dossier.historyPatient.cancelled")) {
        return tEvents("dossier.historyPatient.cancelled");
      }
      if (newStatus === "abandoned" && tEvents.has("dossier.historyPatient.abandoned")) {
        return tEvents("dossier.historyPatient.abandoned");
      }
      if (newStatus === "expired" && tEvents.has("dossier.historyPatient.expired")) {
        return tEvents("dossier.historyPatient.expired");
      }
      if (!oldStatus) return tEvents("dossier.historyPatient.fallback");
      return `${tEvents("dossier.historyPatient.fallbackTransition")} : ${oldStatus} -> ${newStatus}.`;
    },
    [tEvents],
  );

  const dossierPharmacistHeadline = dossierPatientHeadline;

  const dossierReasonTitle = useCallback(
    (reasonKey: string, pharmacist: boolean, productSuffix = ""): string | null => {
      const role = pharmacist ? "pharmacist" : "patient";
      const suffix = productSuffix ?? "";

      if (reasonKey === "audit_single") return tEvents(`dossier.sameStatus.auditSingle.${role}`);
      if (reasonKey === "audit_multiple") return tEvents(`dossier.sameStatus.auditMultiple.${role}`);

      if (reasonKey === "counter_picked_up") {
        return `${tEvents(`dossier.sameStatus.counter_picked_up.${role}`)}${suffix}`;
      }
      if (reasonKey === "counter_unset") {
        return `${tEvents(`dossier.sameStatus.counter_unset.${role}`)}${suffix}`;
      }
      if (reasonKey.startsWith("counter_cancelled_at_counter")) {
        return `${tEvents(`dossier.sameStatus.counter_cancelled_at_counter.${role}`)}${suffix}`;
      }
      if (reasonKey.startsWith("counter_")) {
        return `${tEvents(`dossier.sameStatus.counter_other.${role}`)}${suffix}`;
      }

      const k = `dossier.sameStatus.${reasonKey}.${role}`;
      if (tEvents.has(k)) return tEvents(k);
      return null;
    },
    [tEvents],
  );

  const dossierAuditTitle = useCallback(
    (multiple: boolean, pharmacist: boolean) => {
      const role = pharmacist ? "pharmacist" : "patient";
      return tEvents(multiple ? `dossier.sameStatus.auditMultiple.${role}` : `dossier.sameStatus.auditSingle.${role}`);
    },
    [tEvents],
  );

  const dossierSameStatusFallback = useCallback(
    (pharmacist: boolean) =>
      tEvents(pharmacist ? "dossier.sameStatus.fallback.pharmacist" : "dossier.sameStatus.fallback.patient"),
    [tEvents],
  );

  const dossierOriginTitle = useCallback(
    (pharmacist: boolean) => tEvents(pharmacist ? "origin.pharmacyReceived" : "origin.patientSent"),
    [tEvents],
  );

  const dossierOriginNote = useCallback(
    (pharmacist: boolean, note: string) =>
      tEvents(pharmacist ? "origin.patientNoteAtSendPharmacist" : "origin.patientNoteAtSendPatient", { note }),
    [tEvents],
  );

  const dossierClosureTitle = useCallback(
    (pharmacist: boolean) =>
      tEvents(pharmacist ? "dossierMeta.closureArchivedTitlePharmacist" : "dossierMeta.closureArchivedTitlePatient"),
    [tEvents],
  );

  const dossierFinalStatus = useCallback(
    (pharmacist: boolean, statusLabel: string) =>
      tEvents(pharmacist ? "dossierMeta.finalStatusPharmacist" : "dossierMeta.finalStatusPatient", {
        status: statusLabel,
      }),
    [tEvents],
  );

  const dossierCurrentTitle = useCallback(
    (pharmacist: boolean) =>
      tEvents(pharmacist ? "dossierMeta.currentTitlePharmacist" : "dossierMeta.currentTitlePatient"),
    [tEvents],
  );

  const dossierCurrentStatus = useCallback(
    (statusLabel: string) => tEvents("dossierMeta.currentStatusLabel", { status: statusLabel }),
    [tEvents],
  );

  const dossierAwaitingValidation = useCallback(
    (pharmacist: boolean) =>
      tEvents(pharmacist ? "dossierMeta.awaitingValidationPharmacist" : "dossierMeta.awaitingValidationPatient"),
    [tEvents],
  );

  const actorLabel = useCallback(
    (reason: string | null | undefined, viewerRole: HistoryViewerRole): string => {
      const tone = historyActorToneFromReason(reason, viewerRole);
      if (tone === "patient") return viewerRole === "patient" ? tEvents("actors.you") : tEvents("actors.patient");
      if (tone === "pharmacy") return viewerRole === "patient" ? tEvents("actors.pharmacy") : tEvents("actors.you");
      return tEvents("actors.system");
    },
    [tEvents],
  );

  const actorSummaryFn = useCallback((_pharmacist: boolean) => tEvents("actors.summary"), [tEvents]);
  const actorTodayFn = useCallback((_pharmacist: boolean) => tEvents("actors.now"), [tEvents]);

  const requestStatusLabel = useCallback(
    (status: string) => {
      const key = patientRequestStatusBadgeKey(status);
      if (key) return tStatus(key);
      return status;
    },
    [tStatus],
  );

  const plannedVisitLine = useCallback(
    (dateYmd?: string | null, timePg?: string | null): string | null => {
      const date = (dateYmd ?? "").trim();
      if (!date) return null;
      const formattedDate = formatDateForLocale(date, locale, {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const time = (timePg ?? "").trim();
      if (time) {
        return tCommon("plannedVisitPassageWithTime", { date: formattedDate, time });
      }
      return tCommon("plannedVisitPassageDateOnly", { date: formattedDate });
    },
    [locale, tCommon],
  );

  const channelLabel = useCallback(
    (raw: string | null | undefined): string => {
      if (!raw?.trim()) return "—";
      const slug = raw.trim();
      return tSupply.has(`channels.${slug}`) ? tSupply(`channels.${slug}`) : slug;
    },
    [tSupply],
  );

  const summarizeAmendmentEntryLines = useCallback(
    (entry: SupplyAmendmentEntryJson, _audience: "patient" | "pharmacist"): string[] => {
      const lines: string[] = [];
      const detail = (entry.detail ?? entry.summary ?? "").trim();
      const facts =
        detail && !detail.toLowerCase().includes("request_item") ? splitAmendmentDetailFacts(detail) : [];
      if (facts.length > 0) {
        for (const fact of facts) {
          lines.push(fact.length > 200 ? `${fact.slice(0, 197).trim()}…` : fact);
        }
      }
      if (lines.length === 0) {
        const k = (entry.kind ?? "").trim();
        lines.push(tSupply.has(`facts.${k}`) ? tSupply(`facts.${k}`) : tSupply("facts.default"));
      }
      const ch = entry.client_confirmation_channel ? channelLabel(entry.client_confirmation_channel) : null;
      const mot = entry.client_motive?.trim();
      if (ch) lines.push(tSupply("patientAgreement", { channel: ch }));
      if (mot) lines.push(tSupply("precision", { motive: mot }));
      return lines;
    },
    [channelLabel, tSupply],
  );

  const amendmentBodyLines = summarizeAmendmentEntryLines;

  const qtyLabelKey = (ctx: ProductLineHistoryContext) =>
    ctx.requestType === "prescription" ? "lineBody.requestedQtyPrescription" : "lineBody.requestedQtyDefault";

  const buildPatientRequestOriginLines = useCallback(
    (ctx: ProductLineHistoryContext, productName: string): string[] => {
      const { row } = ctx;
      const ph = ctx.audience === "pharmacist";
      const lines: string[] = [];
      const patientOrigin = ctx.patientLineOriginLabel?.trim();
      if (patientOrigin) lines.push(patientOrigin);
      lines.push(tEvents("lineBody.product", { name: productName }));
      lines.push(tEvents(qtyLabelKey(ctx), { qty: String(row.requested_qty) }));
      if (row.client_comment?.trim()) {
        lines.push(
          tEvents(ph ? "lineBody.patientNotePharmacist" : "lineBody.patientNotePatient", {
            note: row.client_comment.trim(),
          }),
        );
      }
      return lines;
    },
    [tEvents],
  );

  const buildPharmacistProposedIntroLines = useCallback(
    (ctx: ProductLineHistoryContext, productName: string): string[] => {
      const { row } = ctx;
      const originLabel =
        ctx.requestType === "prescription"
          ? ctx.patientLineOriginLabel?.trim() || tEvents("lineBody.pharmacistOriginPrescription")
          : ctx.pharmacistProposedOriginLabel ?? tEvents("lineBody.pharmacistOriginProposed");
      const lines: string[] = [tEvents("lineBody.pharmacistOriginLabel", { origin: originLabel, name: productName })];
      const motif = row.pharmacist_proposal_reason?.trim();
      if (motif) lines.push(tEvents("lineBody.motive", { text: motif }));
      lines.push(
        tEvents(
          ctx.requestType === "prescription" ? "lineBody.proposedQtyPrescription" : "lineBody.proposedQtyDefault",
          { qty: String(row.requested_qty) },
        ),
      );
      return lines;
    },
    [tEvents],
  );

  const buildPharmacistResponseLines = useCallback(
    (ctx: ProductLineHistoryContext, productName: string): string[] => {
      const { row } = ctx;
      const ph = ctx.audience === "pharmacist";
      const rp: string[] = [];
      const principalAvail = row.availability_status
        ? availabilityStatusFr[row.availability_status] ?? row.availability_status
        : null;
      if (principalAvail) rp.push(tEvents("lineBody.availability", { status: principalAvail }));
      if (row.available_qty != null && row.availability_status !== "market_shortage") {
        rp.push(tEvents("lineBody.proposedQty", { qty: String(row.available_qty) }));
      }
      if (row.unit_price != null) {
        rp.push(tEvents("lineBody.unitPrice", { price: Number(row.unit_price).toFixed(2) }));
      }
      if (row.expected_availability_date && row.availability_status === "to_order") {
        rp.push(tEvents("lineBody.receptionPlanned", { date: formatDateShort(row.expected_availability_date) }));
      }
      const alts = altRowsOf(row);
      if (alts.length > 0) {
        const altNames = alts
          .map((alt) => oneProdAlt(alt.products)?.name?.trim())
          .filter(Boolean)
          .slice(0, 3);
        if (altNames.length > 0) {
          rp.push(
            altNames.length === 1
              ? tEvents("lineBody.alternativeOne", { name: altNames[0]! })
              : tEvents("lineBody.alternativesMany", {
                  names: altNames.join(", "),
                  suffix: alts.length > 3 ? "…" : "",
                }),
          );
        }
      }
      if (row.pharmacist_comment?.trim()) {
        rp.push(
          tEvents(ph ? "lineBody.pharmacyNotePharmacist" : "lineBody.pharmacyNotePatient", {
            note: row.pharmacist_comment.trim(),
          }),
        );
      }
      return rp.length > 0 ? rp : [tEvents("lineBody.product", { name: productName })];
    },
    [formatDateShort, tEvents],
  );

  const buildValidationKeptLines = useCallback(
    (ctx: ProductLineHistoryContext, productName: string): string[] => {
      const { row } = ctx;
      const valLines: string[] = [];
      if (row.patient_chosen_alternative_id) {
        valLines.push(tEvents("lineBody.retainedProductAlternative", { name: validatedProductLabel(row) }));
        valLines.push(tEvents("lineBody.initiallyRequested", { name: productName }));
      } else {
        valLines.push(tEvents("lineBody.retainedProduct", { name: validatedProductLabel(row) }));
      }
      valLines.push(tEvents("lineBody.retainedQty", { qty: String(row.selected_qty ?? row.requested_qty) }));
      return valLines;
    },
    [tEvents],
  );

  const buildValidationSkippedLines = useCallback(
    (ctx: ProductLineHistoryContext): string[] => {
      const ph = ctx.audience === "pharmacist";
      const journey = resolveProductLineJourney(ctx.row, ctx.supplyBundles, ctx.requestType);
      if (journey === "pharmacist_proposed_in_response") {
        return [
          tEvents(ph ? "lineBody.validationSkippedProposedPharmacist" : "lineBody.validationSkippedProposedPatient"),
        ];
      }
      return [tEvents(ph ? "lineBody.validationSkippedProductPharmacist" : "lineBody.validationSkippedProductPatient")];
    },
    [tEvents],
  );

  const postConfirmFulfillmentShort = useCallback(
    (value: string | null | undefined): string => {
      if (value === "reserved") return tEvents("lineBody.fulfillmentReserved");
      if (value === "ordered") return tEvents("lineBody.fulfillmentOrdered");
      if (value === "arrived_reserved") return tEvents("lineBody.fulfillmentArrived");
      return tEvents("lineBody.fulfillmentPending");
    },
    [tEvents],
  );

  const originRequestedQtyLabel = useCallback(
    (ctx: ProductLineHistoryContext) => tEvents(qtyLabelKey(ctx), { qty: "" }).replace(/\s*\{qty\}\s*$/, "").trim(),
    [tEvents],
  );

  const counterOutcomeLabel = useCallback(
    (outcome: string, cancelReason?: string | null) => counterOutcomePatientLabel(outcome, cancelReason),
    [],
  );

  const lineBodyText = useCallback(
    (key: string, params?: Record<string, string | number>) => tEvents(`lineBody.${key}`, params),
    [tEvents],
  );

  return useMemo(
    (): TimelineCopyPort => ({
      lineEventTitle,
      dossierPatientHeadline,
      dossierPharmacistHeadline,
      dossierReasonTitle,
      dossierAuditTitle,
      dossierSameStatusFallback,
      dossierOriginTitle,
      dossierOriginNote,
      dossierClosureTitle,
      dossierFinalStatus,
      dossierCurrentTitle,
      dossierCurrentStatus,
      dossierAwaitingValidation,
      actorLabel,
      actorSummary: actorSummaryFn,
      actorToday: actorTodayFn,
      requestStatusLabel,
      plannedVisitLine,
      summarizeAmendmentEntryLines,
      buildPatientRequestOriginLines,
      buildPharmacistProposedIntroLines,
      buildPharmacistResponseLines,
      buildValidationKeptLines,
      buildValidationSkippedLines,
      amendmentBodyLines,
      postConfirmFulfillmentShort,
      originRequestedQtyLabel,
      counterOutcomeLabel,
      formatDateShort,
      lineBodyText,
    }),
    [
      lineEventTitle,
      dossierPatientHeadline,
      dossierPharmacistHeadline,
      dossierReasonTitle,
      dossierAuditTitle,
      dossierSameStatusFallback,
      dossierOriginTitle,
      dossierOriginNote,
      dossierClosureTitle,
      dossierFinalStatus,
      dossierCurrentTitle,
      dossierCurrentStatus,
      dossierAwaitingValidation,
      actorLabel,
      actorSummaryFn,
      actorTodayFn,
      requestStatusLabel,
      plannedVisitLine,
      summarizeAmendmentEntryLines,
      buildPatientRequestOriginLines,
      buildPharmacistProposedIntroLines,
      buildPharmacistResponseLines,
      buildValidationKeptLines,
      buildValidationSkippedLines,
      amendmentBodyLines,
      postConfirmFulfillmentShort,
      originRequestedQtyLabel,
      counterOutcomeLabel,
      formatDateShort,
      lineBodyText,
    ],
  );
}
