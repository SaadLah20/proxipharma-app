"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Ban,
  CheckCircle2,
  CircleCheck,
  Clock,
  MessageCircle,
  ShoppingBasket,
  Send,
  UserX,
  type LucideIcon,
} from "lucide-react";
import type { DemandeStatBucket, DemandeStatBucketKey } from "@/lib/demandes-hub-buckets";
import { countInBucket } from "@/lib/demandes-hub-buckets";

const BUCKET_ICONS: Record<DemandeStatBucketKey, LucideIcon> = {
  envoyees: Send,
  repondues: MessageCircle,
  validees_traitees: CheckCircle2,
  traitee_retrait: ShoppingBasket,
  cloturees: CircleCheck,
  abandonnees: UserX,
  expirees: Clock,
  annulees: Ban,
};

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
    <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-3 shadow-sm sm:p-3.5">
      <div className="mb-3 flex flex-col gap-1 px-0.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-foreground">Vue rapide · demandes de produits</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Touchez un bloc pour ouvrir la liste filtrée (demandes de produits)
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {buckets.map((b) => {
        const n = countInBucket(rows, b);
        const pct = Math.round((n / max) * 100);
        const Icon = BUCKET_ICONS[b.key];
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
              "flex min-h-[118px] flex-col rounded-xl border border-border/90 bg-card p-2.5 text-left shadow-sm transition",
              "hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            )}
          >
            <div className="flex items-start justify-between gap-1.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden>
                <Icon className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-2xl font-bold tabular-nums text-foreground">{n}</span>
            </div>
            <p className="mt-2 text-[11px] font-semibold leading-snug text-foreground">{b.label}</p>
            <p className="text-[10px] font-medium text-primary/90">Filtrer →</p>
            {b.hint ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">{b.hint}</p> : null}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-[width]"
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
