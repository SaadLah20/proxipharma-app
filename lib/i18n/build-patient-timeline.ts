"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/lib/i18n/config";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import {
  buildDossierTimelineFr,
  type DossierTimelineBlockFr,
  type DossierTimelineInputs,
} from "@/lib/build-dossier-timeline-fr";
import {
  buildPatientLineTimelineFr,
  type PatientLineTimelineBlockFr,
  type PatientLineTimelineInputs,
} from "@/lib/build-patient-line-timeline-fr";
import type { LineHistoryPhase } from "@/lib/product-line-history/types";
import { usePatientTimelineCopy } from "@/lib/i18n/patient-timeline-copy";

export type TimelineBlockLike = {
  atIso: string | null;
  atLabel: string;
  phase?: LineHistoryPhase;
  phaseLabel?: string;
};

export function localizeTimelineAtLabels<T extends TimelineBlockLike>(
  blocks: T[],
  locale: AppLocale,
): T[] {
  return blocks.map((b) => ({
    ...b,
    atLabel: b.atIso ? formatDateTimeShortForLocale(b.atIso, locale) : b.atLabel,
  }));
}

export function useTimelinePhaseLabels(): Record<LineHistoryPhase, string> {
  const t = useTranslations("timeline.phases");
  return {
    origin: t("origin"),
    response: t("response"),
    validation: t("validation"),
    preparation: t("preparation"),
    counter: t("counter"),
    epilogue: t("epilogue"),
  };
}

export function applyTimelinePhaseLabels<T extends TimelineBlockLike>(
  blocks: T[],
  phaseLabels: Record<LineHistoryPhase, string>,
): T[] {
  return blocks.map((b) =>
    b.phase ? { ...b, phaseLabel: phaseLabels[b.phase] ?? b.phaseLabel } : b,
  );
}

export function usePatientDossierTimeline(
  input: Omit<DossierTimelineInputs, "viewerRole" | "locale">,
): DossierTimelineBlockFr[] {
  const locale = useLocale() as AppLocale;
  const phaseLabels = useTimelinePhaseLabels();
  const copy = usePatientTimelineCopy();

  return useMemo(() => {
    const blocks = buildDossierTimelineFr({
      ...input,
      viewerRole: "patient",
      locale,
      copy,
    });
    return applyTimelinePhaseLabels(localizeTimelineAtLabels(blocks, locale), phaseLabels);
  }, [input, locale, phaseLabels, copy]);
}

export function usePatientLineTimeline(
  input: Omit<PatientLineTimelineInputs, "timelineAudience" | "locale" | "phaseLabels">,
): PatientLineTimelineBlockFr[] {
  const locale = useLocale() as AppLocale;
  const phaseLabels = useTimelinePhaseLabels();
  const copy = usePatientTimelineCopy();

  return useMemo(() => {
    const blocks = buildPatientLineTimelineFr({
      ...input,
      timelineAudience: "patient",
      locale,
      phaseLabels,
      copy,
    });
    return applyTimelinePhaseLabels(localizeTimelineAtLabels(blocks, locale), phaseLabels);
  }, [input, locale, phaseLabels, copy]);
}
