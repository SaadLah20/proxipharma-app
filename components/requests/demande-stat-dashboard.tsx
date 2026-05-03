"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { DemandeStatBucket } from "@/lib/demandes-hub-buckets";
import { countInBucket } from "@/lib/demandes-hub-buckets";

type Row = { status: string };

export function DemandeStatDashboard({
  rows,
  buckets,
  basePath,
}: {
  rows: Row[];
  buckets: DemandeStatBucket[];
  basePath: "/dashboard/demandes" | "/dashboard/pharmacien/demandes";
}) {
  const router = useRouter();
  const max = Math.max(1, ...buckets.map((b) => countInBucket(rows, b)));

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {buckets.map((b) => {
        const n = countInBucket(rows, b);
        const pct = Math.round((n / max) * 100);
        return (
          <button
            key={b.key}
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              next.set("vue", "liste");
              next.set("statut", b.key);
              router.replace(`${basePath}?${next.toString()}`, { scroll: false });
            }}
            className={clsx(
              "flex flex-col rounded-lg border border-border/90 bg-card p-2.5 text-left shadow-sm transition",
              "hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl font-bold tabular-nums text-foreground">{n}</span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">voir</span>
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-tight text-foreground">{b.label}</p>
            {b.hint ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{b.hint}</p> : null}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/70 transition-[width]"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
