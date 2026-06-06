"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HistoryTimelineFr } from "@/components/requests/history-timeline-fr";
import {
  buildDossierTimelineFr,
  type DossierHistoryRowInput,
  type DossierTimelineInputs,
} from "@/lib/build-dossier-timeline-fr";
import type { AppLocale } from "@/lib/i18n/config";
import {
  applyTimelinePhaseLabels,
  localizeTimelineAtLabels,
  useTimelinePhaseLabels,
} from "@/lib/i18n/build-patient-timeline";
import type { HistoryViewerRole } from "@/lib/request-history-fr";

export function DossierHistoryListFr({
  rows,
  viewerRole,
  busy = false,
  emptyLabel,
  timeline,
  supplyBundles,
}: {
  rows: DossierHistoryRowInput[];
  viewerRole: HistoryViewerRole;
  busy?: boolean;
  emptyLabel?: string;
  /** Métadonnées dossier pour la chronologie narrative (recommandé). */
  timeline?: Omit<DossierTimelineInputs, "rows" | "viewerRole" | "supplyBundles" | "locale">;
  supplyBundles?: DossierTimelineInputs["supplyBundles"];
}) {
  const locale = useLocale() as AppLocale;
  const tTimeline = useTranslations("timeline.dossier");
  const phaseLabels = useTimelinePhaseLabels();
  const isPatient = viewerRole === "patient";

  const blocks = useMemo(() => {
    const built = buildDossierTimelineFr({
      rows,
      viewerRole,
      supplyBundles,
      locale: isPatient ? locale : undefined,
      requestCreatedAt: timeline?.requestCreatedAt ?? rows[0]?.created_at ?? new Date().toISOString(),
      requestSubmittedAt: timeline?.requestSubmittedAt ?? null,
      requestRespondedAt: timeline?.requestRespondedAt ?? null,
      requestConfirmedAt: timeline?.requestConfirmedAt ?? null,
      requestStatus: timeline?.requestStatus ?? rows[rows.length - 1]?.new_status ?? "submitted",
      patientNote: timeline?.patientNote,
      plannedVisitDate: timeline?.plannedVisitDate,
      plannedVisitTime: timeline?.plannedVisitTime,
    });
    if (!isPatient) return built;
    return applyTimelinePhaseLabels(localizeTimelineAtLabels(built, locale), phaseLabels);
  }, [rows, viewerRole, timeline, supplyBundles, locale, isPatient, phaseLabels]);

  if (busy) {
    return <p className="text-[11px] text-muted-foreground">{tTimeline("loading")}</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug text-muted-foreground">{tTimeline("intro")}</p>
      <HistoryTimelineFr
        blocks={blocks}
        emptyLabel={emptyLabel ?? tTimeline("empty")}
      />
    </div>
  );
}
