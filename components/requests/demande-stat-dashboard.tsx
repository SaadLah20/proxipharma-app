"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import type { DemandeStatBucket } from "@/lib/demandes-hub-buckets";
import { countInBucket } from "@/lib/demandes-hub-buckets";

type Row = { status: string; status_for_dashboard?: string };

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
    <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-2.5 shadow-sm sm:p-3">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-sky-950">Vue rapide des demandes</h2>
        <p className="text-[10px] text-sky-900/85">Touchez un bloc pour ouvrir la liste filtrée</p>
      </div>
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
              "flex min-h-[112px] flex-col rounded-xl border border-sky-100 bg-white p-2.5 text-left shadow-sm transition",
              "hover:border-sky-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl font-bold tabular-nums text-sky-950">{n}</span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-sky-700/80">ouvrir</span>
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
    </div>
  );
}
