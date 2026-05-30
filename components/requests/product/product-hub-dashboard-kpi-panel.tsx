"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { BarChart3 } from "lucide-react";
import { countInBucket, type DemandeStatBucket } from "@/lib/demandes-hub-buckets";
import { neutralCardShell } from "@/lib/design-system/request-kind-accent";

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
    <section className={clsx(neutralCardShell, "p-4 sm:p-5")}>
      <div className="mb-3 flex items-start gap-2">
        <BarChart3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div>
          <h3 className="text-base font-semibold text-foreground">Synthèse</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Touchez un statut pour ouvrir la liste filtrée.
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border/80 bg-muted/30 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{total}</p>
          <p className="text-xs font-medium text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{activeCount}</p>
          <p className="text-xs font-medium text-muted-foreground">En cours</p>
        </div>
        <div className="rounded-lg border border-border/80 bg-muted/30 px-2 py-2 text-center">
          <p className="text-lg font-bold tabular-nums text-foreground">{unreadCount}</p>
          <p className="text-xs font-medium text-muted-foreground">
            {role === "pharmacien" ? "Messages non lus" : "Non lus"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bucketCounts.map(({ bucket, count }) => (
          <Link
            key={bucket.key}
            href={`${basePath}?vue=liste&statut=${bucket.key}`}
            className="rounded-lg border border-border/80 bg-card px-2 py-2 text-center transition hover:bg-muted/40"
          >
            <p className="text-base font-bold tabular-nums text-foreground">{count}</p>
            <p className="text-xs font-medium text-muted-foreground">{bucket.label}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
