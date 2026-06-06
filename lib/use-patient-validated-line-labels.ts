"use client";

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { postConfirmSupplyAmendmentBadgeLabelsFr } from "@/lib/build-patient-line-timeline-fr";
import {
  effectiveAvailabilityForPatientLine,
  effectiveEtaForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import { formatDateForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import {
  isPatientAjoutOfficineLine,
  isRequestItemAddedAfterPatientConfirmation,
} from "@/lib/supply-line-post-confirm";
import {
  type ValidatedLineLabel,
  type ValidatedLineLabelTone,
} from "@/lib/patient-validated-line-labels-fr";

type ValidatedT = ReturnType<typeof useTranslations<"demandes.validated">>;
type TimelineT = ReturnType<typeof useTranslations<"timeline">>;
type CommonT = ReturnType<typeof useTranslations<"common">>;

function mapAmendmentBadgeI18n(
  raw: string,
  tValidated: ValidatedT,
  tTimeline: TimelineT,
): string | null {
  switch (raw) {
    case "Modifié après validation":
    case "Quantité ajustée":
      return tValidated("modifiedByPharmacy");
    case "Ajouté par la pharmacie":
      return tTimeline("addedByPharmacy");
    case "Retiré par la pharmacie":
    case "Écarté de la commande active":
      return tTimeline("withdrawn");
    case "Récupéré au comptoir":
      return tTimeline("collectedAtCounter");
    default:
      return null;
  }
}

function fulfillmentStatusLabelI18n(
  row: PatientLineLike,
  tValidated: ValidatedT,
  treatedLineLabels?: boolean,
): string | null {
  if (!row.is_selected_by_patient) return null;
  const eff = effectiveAvailabilityForPatientLine(row);
  const pcf = row.post_confirm_fulfillment ?? "unset";
  if (treatedLineLabels) {
    if (eff === "available" || eff === "partially_available") {
      if (pcf === "reserved") return null;
      return tValidated("awaitingYourVisit");
    }
    if (eff === "to_order") {
      if (pcf === "arrived_reserved") return tValidated("receivedAtPharmacy");
      return null;
    }
    return null;
  }
  if (eff === "available" || eff === "partially_available") {
    if (pcf === "reserved") return tValidated("reserved");
    return tValidated("reservedByPharmacy");
  }
  if (eff === "to_order") {
    if (pcf === "arrived_reserved") return tValidated("receivedAtPharmacy");
    if (pcf === "ordered") return tValidated("ordered");
    return tValidated("toOrder");
  }
  return null;
}

function isRedundantSectionStatusLabelI18n(
  status: string,
  tValidated: ValidatedT,
  sectionBucket?:
    | "dispo_officine"
    | "commande"
    | "hors_perimetre"
    | "retire_apres_validation"
    | "non_retenu",
  treatedLineLabels?: boolean,
): boolean {
  if (!sectionBucket) return false;
  if (
    sectionBucket === "dispo_officine" &&
    (status === tValidated("reservedByPharmacy") || status === tValidated("toReserve"))
  ) {
    return true;
  }
  if (
    sectionBucket === "commande" &&
    (status === tValidated("toOrder") || status === tValidated("ordered"))
  ) {
    return true;
  }
  if (
    treatedLineLabels &&
    sectionBucket === "dispo_officine" &&
    status === tValidated("awaitingYourVisit")
  ) {
    return true;
  }
  return false;
}

const TREATED_OMIT_STATUS_KEYS = new Set(["reserved", "ordered", "toReserve", "toOrder"]);

export function buildPatientValidatedLineLabels(input: {
  row: PatientLineLike;
  originLabel: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  archiveClosureLabel?: string | null;
  treatedLineLabels?: boolean;
  sectionBucket?:
    | "dispo_officine"
    | "commande"
    | "hors_perimetre"
    | "retire_apres_validation"
    | "non_retenu";
  tValidated: ValidatedT;
  tTimeline: TimelineT;
  tCommon: CommonT;
  defaultOriginLabels: readonly string[];
  formatDateShort: (iso: string) => string;
}): ValidatedLineLabel[] {
  const {
    row,
    originLabel,
    supplyAmendmentBundles,
    archiveClosureLabel,
    treatedLineLabels,
    sectionBucket,
    tValidated,
    tTimeline,
    tCommon,
    defaultOriginLabels,
    formatDateShort,
  } = input;

  const out: ValidatedLineLabel[] = [];
  if (originLabel.trim() && !defaultOriginLabels.includes(originLabel)) {
    out.push({ key: "origin", text: originLabel, tone: "origin" });
  }

  const withdrawn = Boolean(row.withdrawn_after_confirm);
  const ajoutOrigin =
    isPatientAjoutOfficineLine(row) ||
    isRequestItemAddedAfterPatientConfirmation(row.id, supplyAmendmentBundles);

  const closure = archiveClosureLabel?.trim();
  const pickedUp = (row.counter_outcome ?? "unset") === "picked_up";
  if (closure) {
    out.push({ key: "closure", text: closure, tone: "status" });
  } else if (withdrawn) {
    out.push({ key: "ecart", text: tValidated("withdrawnByPharmacy"), tone: "event" });
  } else if (pickedUp) {
    out.push({ key: "collected", text: tCommon("collected"), tone: "collected" });
  } else {
    const status = fulfillmentStatusLabelI18n(row, tValidated, treatedLineLabels);
    const statusKey =
      status === tValidated("receivedAtPharmacy")
        ? "arrived"
        : status === tValidated("reserved")
          ? "reserved"
          : status === tValidated("ordered")
            ? "ordered"
            : status === tValidated("toOrder")
              ? "toOrder"
              : status === tValidated("toReserve") || status === tValidated("reservedByPharmacy")
                ? "toReserve"
                : "status";
    if (
      status &&
      !(treatedLineLabels && TREATED_OMIT_STATUS_KEYS.has(statusKey)) &&
      !isRedundantSectionStatusLabelI18n(status, tValidated, sectionBucket, treatedLineLabels)
    ) {
      out.push({
        key: status === tValidated("receivedAtPharmacy") ? "arrived" : "status",
        text: status,
        tone: (status === tValidated("receivedAtPharmacy") ? "arrived" : "status") as ValidatedLineLabelTone,
      });
    }
    const eff = effectiveAvailabilityForPatientLine(row);
    const eta = effectiveEtaForPatientLine(row);
    const pcf = row.post_confirm_fulfillment ?? "unset";
    const receivedAtPharmacy = pcf === "arrived_reserved";
    if (eta && eff === "to_order" && !receivedAtPharmacy) {
      const date = formatDateShort(eta);
      out.push({
        key: "reception",
        text:
          eff === "to_order"
            ? tValidated("receptionPlanned", { date })
            : tValidated("reception", { date }),
        tone: "reception",
      });
    }
  }

  const seenEvent = new Set<string>();
  const rawAmends = postConfirmSupplyAmendmentBadgeLabelsFr(
    row,
    supplyAmendmentBundles as { id: string; created_at: string; amendments: unknown }[],
  );
  const addedLabel = tTimeline("addedByPharmacy");
  const withdrawnLabel = tValidated("withdrawnByPharmacy");
  for (const raw of rawAmends) {
    const mapped = mapAmendmentBadgeI18n(raw, tValidated, tTimeline);
    if (!mapped || seenEvent.has(mapped)) continue;
    if (mapped === addedLabel && ajoutOrigin) continue;
    if (mapped === withdrawnLabel && (withdrawn || out.some((l) => l.key === "ecart"))) continue;
    seenEvent.add(mapped);
    out.push({ key: `event-${mapped}`, text: mapped, tone: "event" });
  }

  return out;
}

export function usePatientValidatedLineLabels(defaultOriginLabels: readonly string[]) {
  const locale = useLocale() as AppLocale;
  const tValidated = useTranslations("demandes.validated");
  const tTimeline = useTranslations("timeline");
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

  const buildLabels = useCallback(
    (input: Omit<
      Parameters<typeof buildPatientValidatedLineLabels>[0],
      "tValidated" | "tTimeline" | "tCommon" | "defaultOriginLabels" | "formatDateShort"
    >) =>
      buildPatientValidatedLineLabels({
        ...input,
        tValidated,
        tTimeline,
        tCommon,
        defaultOriginLabels,
        formatDateShort,
      }),
    [tValidated, tTimeline, tCommon, defaultOriginLabels, formatDateShort],
  );

  return { buildLabels, tValidated, tTimeline, tCommon };
}
