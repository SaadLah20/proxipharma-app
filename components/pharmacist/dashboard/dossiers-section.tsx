"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import { CollapsibleDetails } from "@/components/ui/collapsible-details";
import {
  pharmacistWorkflowGroupCounts,
  type PharmacistDashboardSnapshot,
} from "@/lib/pharmacist-dashboard";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { statBucketGroupsForRole } from "@/lib/demandes-hub-buckets";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";

const DEMANDES_HUB = "/dashboard/pharmacien/demandes";

function snapshotRowsForStatDashboard(byStatus: Record<string, number>) {
  const rows: { status: string; status_for_dashboard: string }[] = [];
  for (const [status, count] of Object.entries(byStatus)) {
    const n = Math.max(0, Math.floor(Number(count) || 0));
    for (let i = 0; i < n; i++) rows.push({ status, status_for_dashboard: status });
  }
  return rows;
}

export function PharmacistDashboardDossiersSection({ snapshot }: { snapshot: PharmacistDashboardSnapshot }) {
  const groups = useMemo(
    () => pharmacistWorkflowGroupCounts(snapshot.requests.by_status),
    [snapshot.requests.by_status]
  );

  const statDashboardRows = useMemo(
    () => snapshotRowsForStatDashboard(snapshot.requests.by_status),
    [snapshot.requests.by_status]
  );
  const statDashboardBuckets = useMemo(() => dashboardBucketsForKind("product_request", "pharmacien"), []);

  const periodHint =
    snapshot.requests.new_in_period > 0
      ? `${snapshot.requests.new_in_period} nouvelle(s) sur la période · ${snapshot.requests.active_total} dossier(s) actif(s)`
      : `${snapshot.requests.active_total} dossier(s) actif(s)`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Dossiers</h2>
          <p className="text-[11px] text-muted-foreground">{periodHint}</p>
        </div>
        <Link
          href={DEMANDES_HUB}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Ouvrir le hub Demandes
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {groups.map((group) => (
          <div key={group.id} className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{group.count}</p>
            {group.subtitle ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{group.subtitle}</p>
            ) : null}
          </div>
        ))}
      </div>

      {statDashboardRows.length > 0 ? (
        <CollapsibleDetails title="Détail des 8 statuts" variant="card">
          <div className="pt-2">
            <DemandeStatDashboard
              rows={statDashboardRows}
              buckets={statDashboardBuckets}
              basePath={DEMANDES_HUB}
              density="compact"
              dashboardTitle="8 statuts"
              dashboardSubtitle="Tous parcours confondus."
              bucketGroups={statBucketGroupsForRole("pharmacien")}
            />
          </div>
        </CollapsibleDetails>
      ) : (
        <p className={chrome.heroSubtitle}>Aucun dossier pour le moment.</p>
      )}
    </div>
  );
}
