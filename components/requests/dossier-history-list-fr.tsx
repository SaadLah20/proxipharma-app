"use client";

import { HistoryTimelineFr } from "@/components/requests/history-timeline-fr";
import { formatDossierHistoryRow, type HistoryViewerRole } from "@/lib/request-history-fr";

export function DossierHistoryListFr({
  rows,
  viewerRole,
  busy = false,
  emptyLabel,
}: {
  rows: {
    id: string;
    created_at: string;
    old_status: string | null;
    new_status: string;
    reason: string | null;
  }[];
  viewerRole: HistoryViewerRole;
  busy?: boolean;
  emptyLabel?: string;
}) {
  if (busy) {
    return <p className="text-[11px] text-muted-foreground">Chargement de l&apos;historique…</p>;
  }
  const events = [...rows]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((r) => formatDossierHistoryRow(r, viewerRole));
  return (
    <HistoryTimelineFr
      dossierEvents={events}
      emptyLabel={emptyLabel ?? "Aucun événement enregistré pour ce dossier."}
    />
  );
}
