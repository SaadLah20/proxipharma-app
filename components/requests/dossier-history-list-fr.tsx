"use client";

import { useMemo } from "react";
import { HistoryTimelineFr } from "@/components/requests/history-timeline-fr";
import {
  buildDossierTimelineFr,
  type DossierHistoryRowInput,
  type DossierTimelineInputs,
} from "@/lib/build-dossier-timeline-fr";
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
  timeline?: Omit<DossierTimelineInputs, "rows" | "viewerRole" | "supplyBundles">;
  supplyBundles?: DossierTimelineInputs["supplyBundles"];
}) {
  const blocks = useMemo(() => {
    if (!timeline) {
      return buildDossierTimelineFr({
        rows,
        viewerRole,
        supplyBundles,
        requestCreatedAt: rows[0]?.created_at ?? new Date().toISOString(),
        requestSubmittedAt: null,
        requestRespondedAt: null,
        requestConfirmedAt: null,
        requestStatus: rows[rows.length - 1]?.new_status ?? "submitted",
      });
    }
    return buildDossierTimelineFr({
      rows,
      viewerRole,
      supplyBundles,
      ...timeline,
    });
  }, [rows, viewerRole, timeline, supplyBundles]);

  if (busy) {
    return <p className="text-[11px] text-muted-foreground">Chargement de l&apos;historique…</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] leading-snug text-muted-foreground">
        Du plus ancien au plus récent — chaque étape du dossier avec ses détails.
      </p>
      <HistoryTimelineFr
        blocks={blocks}
        emptyLabel={emptyLabel ?? "Aucun événement enregistré pour ce dossier."}
      />
    </div>
  );
}
