"use client";

import { useCallback, useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/lib/i18n/config";
import {
  archiveTerminalFootnoteForLocale,
  formatDateShortYmdForLocale,
  formatDateTimeShortForLocale,
  formatDossierSentAtCompactForLocale,
  formatPlannedVisitForLocale,
  formatTimePgForLocale,
  patientArchiveLastPlannedVisitFootnoteForLocale,
  plannedVisitPassageLineForLocale,
} from "@/lib/datetime-locale";

export function usePatientDatetimeFormatters() {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common");

  const formatDateShort = useCallback(
    (ymd: string | null | undefined) => formatDateShortYmdForLocale(ymd, locale),
    [locale],
  );

  const formatDateTimeShort = useCallback(
    (iso: string | null | undefined) => formatDateTimeShortForLocale(iso, locale),
    [locale],
  );

  const formatPlannedVisit = useCallback(
    (dateYmd: string | null | undefined, timePg: string | null | undefined) =>
      formatPlannedVisitForLocale(dateYmd, timePg, locale),
    [locale],
  );

  const formatTimePg = useCallback(
    (pgTime: string | null | undefined) => formatTimePgForLocale(pgTime, locale),
    [locale],
  );

  const formatDossierSentAtCompact = useCallback(
    (iso: string | null | undefined) => formatDossierSentAtCompactForLocale(iso, locale),
    [locale],
  );

  const plannedVisitPassageLine = useCallback(
    (dateYmd: string | null | undefined, timePg: string | null | undefined) =>
      plannedVisitPassageLineForLocale(dateYmd, timePg, locale, {
        withTime: (date, time) => t("plannedVisitPassageWithTime", { date, time }),
        dateOnly: (date) => t("plannedVisitPassageDateOnly", { date }),
      }),
    [locale, t],
  );

  const archiveLastPlannedVisitFootnote = useCallback(
    (dateYmd: string | null | undefined, timePg: string | null | undefined) =>
      patientArchiveLastPlannedVisitFootnoteForLocale(dateYmd, timePg, locale, {
        indicative: t("plannedVisitIndicative"),
        indicativeRelative: (relative) => t("plannedVisitIndicativeRelative", { relative }),
      }),
    [locale, t],
  );

  const archiveTerminalFootnote = useCallback(
    (iso: string | null | undefined) =>
      archiveTerminalFootnoteForLocale(iso, locale, t("archiveClosedOn")),
    [locale, t],
  );

  return useMemo(
    () => ({
      locale,
      formatDateShort,
      formatDateTimeShort,
      formatPlannedVisit,
      formatTimePg,
      formatDossierSentAtCompact,
      plannedVisitPassageLine,
      archiveLastPlannedVisitFootnote,
      archiveTerminalFootnote,
    }),
    [
      locale,
      formatDateShort,
      formatDateTimeShort,
      formatPlannedVisit,
      formatTimePg,
      formatDossierSentAtCompact,
      plannedVisitPassageLine,
      archiveLastPlannedVisitFootnote,
      archiveTerminalFootnote,
    ],
  );
}
