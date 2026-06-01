"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { BarChart3 } from "lucide-react";
import { countInBucket, type DemandeStatBucket } from "@/lib/demandes-hub-buckets";
import { uiSurfaceCard } from "@/lib/ui-surfaces";

type HubRow = { id: string; status: string; status_for_dashboard?: string };

export function ProductHubDashboardKpiPanel({
  rows,
  buckets,
  basePath,
  unreadById = {},
  role,
}: {
  rows: HubRow[];
  buckets: DemandeStatBucket[];
  basePath: string;
  unreadById?: Record<string, boolean>;
  role: "patient" | "pharmacien";
}) {
  const total = rows.length;
  const unreadCount = rows.filter((r) => unreadById[r.id] === true).length;
  const archiveBucketKeys = new Set<DemandeStatBucket["key"]>([
    "cloturees",
    "abandonnees",
    "expirees",
    "annulees",
  ]);
  const archiveCount = buckets
    .filter((b) => archiveBucketKeys.has(b.key))
    .reduce((sum, b) => sum + countInBucket(rows, b), 0);
  const activeCount = Math.max(0, total - archiveCount);

  const bucketCounts = buckets.map((bucket) => ({
    bucket,
    count: countInBucket(rows, bucket),
  }));

  return (
    <section className={clsx(uiSurfaceCard, "p-3 sm:p-3.5")}>
      <div className="mb-3 flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <h3 className="text-sm font-bold text-foreground">Synthèse des dossiers</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Répartition par statut — touchez un chiffre pour ouvrir la liste filtrée.
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{total}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{activeCount}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">En cours</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{unreadCount}</p>
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            {role === "pharmacien" ? "Messages non lus" : "Non lus"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {bucketCounts.map(({ bucket, count }) => (
          <Link
            key={bucket.key}
            href={`${basePath}?vue=liste&statut=${bucket.key}`}
            className={clsx(
              "rounded-lg border px-2 py-1.5 text-left transition hover:-translate-y-px hover:shadow-sm",
              count > 0
                ? "border-border bg-card hover:bg-muted/40"
                : "border-border/60 bg-muted/20 opacity-75 hover:opacity-100"
            )}
          >
            <p className="text-base font-bold tabular-nums text-foreground">{count}</p>
            <p className="text-[9px] font-semibold leading-tight text-muted-foreground">{bucket.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
