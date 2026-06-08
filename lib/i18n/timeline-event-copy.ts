"use client";

import { useTranslations } from "next-intl";
import type { ProductLineJourneyKind } from "@/lib/product-line-history/line-journey";
import type { LineEventKind } from "@/lib/product-line-history/types";

type Audience = "patient" | "pharmacist";

function statusPairKey(oldStatus: string | null, newStatus: string): string {
  const o = (oldStatus ?? "").trim();
  const n = newStatus.trim();
  if (!o) return n;
  return `${o}_to_${n}`;
}

export function useTimelineCopyResolver() {
  const t = useTranslations("timeline.events");

  const lineEventTitle = (
    kind: LineEventKind,
    audience: Audience,
    journey: ProductLineJourneyKind = "patient_requested"
  ): string => {
    const base = `line.${kind}`;
    const audienceKey = audience === "pharmacist" ? "pharmacist" : "patient";
    const journeyKey = `${base}.${audienceKey}.${journey}`;
    if (t.has(journeyKey)) return t(journeyKey);
    const audienceSimpleKey = `${base}.${audienceKey}`;
    if (t.has(audienceSimpleKey)) return t(audienceSimpleKey);
    return t(`line.fallback.${audienceKey}`);
  };

  const dossierPatientHeadline = (oldStatus: string | null, newStatus: string): string => {
    const key = statusPairKey(oldStatus, newStatus);
    if (t.has(`dossier.historyPatient.${key}`)) return t(`dossier.historyPatient.${key}`);
    if (!oldStatus && t.has(`dossier.historyPatient.${newStatus}`)) {
      return t(`dossier.historyPatient.${newStatus}`);
    }
    if (newStatus === "cancelled" && t.has("dossier.historyPatient.cancelled")) {
      return t("dossier.historyPatient.cancelled");
    }
    if (newStatus === "abandoned" && t.has("dossier.historyPatient.abandoned")) {
      return t("dossier.historyPatient.abandoned");
    }
    if (newStatus === "expired" && t.has("dossier.historyPatient.expired")) {
      return t("dossier.historyPatient.expired");
    }
    if (!oldStatus) return t("dossier.historyPatient.fallback");
    return `${t("dossier.historyPatient.fallbackTransition")} : ${oldStatus} -> ${newStatus}.`;
  };

  const dossierReasonTitle = (
    reasonKey: string,
    pharmacist: boolean,
    productSuffix?: string
  ): string | null => {
    const role = pharmacist ? "pharmacist" : "patient";
    const suffix = productSuffix ?? "";

    if (reasonKey === "audit_single") return t(`dossier.sameStatus.auditSingle.${role}`);
    if (reasonKey === "audit_multiple") return t(`dossier.sameStatus.auditMultiple.${role}`);

    if (reasonKey === "counter_picked_up") {
      return `${t(`dossier.sameStatus.counter_picked_up.${role}`)}${suffix}`;
    }
    if (reasonKey === "counter_unset") {
      return `${t(`dossier.sameStatus.counter_unset.${role}`)}${suffix}`;
    }
    if (reasonKey.startsWith("counter_cancelled_at_counter")) {
      return `${t(`dossier.sameStatus.counter_cancelled_at_counter.${role}`)}${suffix}`;
    }
    if (reasonKey.startsWith("counter_")) {
      return `${t(`dossier.sameStatus.counter_other.${role}`)}${suffix}`;
    }

    const k = `dossier.sameStatus.${reasonKey}.${role}`;
    if (t.has(k)) return t(k);
    return null;
  };

  const dossierOriginTitle = (pharmacist: boolean): string => {
    return pharmacist ? t("origin.pharmacyReceived") : t("origin.patientSent");
  };

  const localizeActorLabel = (raw: string): string => {
    const v = raw.trim().toLowerCase();
    if (v === "vous" || v === "you" || v === "vous (pharmacie)") return t("actors.you");
    if (v === "le patient" || v === "patient") return t("actors.patient");
    if (v === "la pharmacie" || v === "officine" || v === "pharmacy") return t("actors.pharmacy");
    if (v === "automatique" || v === "systeme" || v === "système" || v === "system") {
      return t("actors.system");
    }
    if (v === "aujourd'hui" || v === "maintenant" || v === "today" || v === "now") return t("actors.now");
    if (v === "recapitulatif" || v === "récapitulatif" || v === "recap" || v === "synthese" || v === "synthèse") {
      return t("actors.summary");
    }
    return raw;
  };

  return {
    lineEventTitle,
    dossierPatientHeadline,
    dossierReasonTitle,
    dossierOriginTitle,
    localizeActorLabel,
  };
}
