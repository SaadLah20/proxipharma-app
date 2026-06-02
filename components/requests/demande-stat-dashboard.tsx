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
import { InfoHint } from "@/components/ui/info-hint";
import type {
  DemandeStatBucket,
  DemandeStatBucketGroup,
  DemandeStatBucketKey,
} from "@/lib/demandes-hub-buckets";
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

function StatBucketTile({
  bucket,
  rows,
  max,
  compact,
  onOpen,
}: {
  bucket: DemandeStatBucket;
  rows: Row[];
  max: number;
  compact: boolean;
  onOpen: (key: DemandeStatBucketKey) => void;
}) {
  const n = countInBucket(rows, bucket);
  const pct = Math.round((n / max) * 100);
  const Icon = BUCKET_ICONS[bucket.key];

  return (
    <button
      type="button"
      onClick={() => onOpen(bucket.key)}
      className={clsx(
        "flex flex-col rounded-lg border border-border/90 bg-card text-left shadow-sm ring-1 ring-black/[0.03] transition",
        compact ? "min-h-[5.5rem] p-2" : "min-h-[118px] rounded-xl p-2.5",
        "hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary",
            compact ? "size-7" : "size-8"
          )}
          aria-hidden
        >
          <Icon className={compact ? "size-3.5" : "size-4"} strokeWidth={2.25} />
        </span>
        <span className={clsx("font-bold tabular-nums text-foreground", compact ? "text-xl" : "text-2xl")}>{n}</span>
      </div>
      <p
        className={clsx("font-semibold leading-snug text-foreground", compact ? "mt-1 text-[10px]" : "mt-1.5 text-[11px]")}
        title={bucket.hint ?? undefined}
      >
        {bucket.label}
      </p>
      <div className={clsx("w-full overflow-hidden rounded-full bg-muted", compact ? "mt-1 h-1" : "mt-2 h-1.5")}>
        <div
          className="h-full rounded-full bg-primary/60 transition-[width]"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </button>
  );
}

const GROUP_ACCENT: Record<string, { shell: string; label: string; badge: string }> = {
  at_pharmacy: {
    shell: "border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-card to-sky-50/40 ring-sky-200/50",
    label: "text-sky-950",
    badge: "bg-sky-600/10 text-sky-900",
  },
  your_action: {
    shell: "border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-card to-emerald-50/35 ring-emerald-200/50",
    label: "text-emerald-950",
    badge: "bg-emerald-600/10 text-emerald-900",
  },
  at_patient: {
    shell: "border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-card to-amber-50/35 ring-amber-200/50",
    label: "text-amber-950",
    badge: "bg-amber-600/10 text-amber-900",
  },
  archives: {
    shell: "border-border/60 bg-muted/15 ring-border/40",
    label: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

function StatGroupHelp({
  group,
  buckets,
}: {
  group: DemandeStatBucketGroup;
  buckets: DemandeStatBucket[];
}) {
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  return (
    <InfoHint label={`Aide — ${group.label}`} align="end" placement="down">
      <p className="font-semibold text-foreground">{group.label}</p>
      {group.subtitle ? <p className="mt-1 text-muted-foreground">{group.subtitle}</p> : null}
      <ul className="mt-2 space-y-1.5">
        {group.bucketKeys.map((key) => {
          const bucket = bucketByKey.get(key);
          if (!bucket) return null;
          return (
            <li key={key}>
              <span className="font-semibold text-foreground">{bucket.label}</span>
              {bucket.hint ? <span className="text-muted-foreground"> — {bucket.hint}</span> : null}
            </li>
          );
        })}
      </ul>
    </InfoHint>
  );
}

export function DemandeStatDashboard({
  rows,
  buckets,
  basePath,
  density = "compact",
  dashboardTitle = "8 statuts",
  dashboardSubtitle,
  bucketGroups,
}: {
  rows: Row[];
  buckets: DemandeStatBucket[];
  basePath: string;
  density?: "default" | "compact";
  dashboardTitle?: string;
  dashboardSubtitle?: string;
  /** Tuiles regroupées par repère patient / pharmacie / archives. */
  bucketGroups?: DemandeStatBucketGroup[];
}) {
  const router = useRouter();
  const max = Math.max(1, ...buckets.map((b) => countInBucket(rows, b)));
  const compact = density === "compact";
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  const openBucket = (key: DemandeStatBucketKey) => {
    const next = new URLSearchParams();
    next.set("vue", "liste");
    next.set("statut", key);
    router.replace(`${basePath}?${next.toString()}`, { scroll: false });
  };

  const renderTiles = (keys: readonly DemandeStatBucketKey[]) =>
    keys.map((key) => {
      const bucket = bucketByKey.get(key);
      if (!bucket) return null;
      return (
        <StatBucketTile
          key={key}
          bucket={bucket}
          rows={rows}
          max={max}
          compact={compact}
          onOpen={openBucket}
        />
      );
    });

  return (
    <div
      className={clsx(
        "rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-sm sm:shadow-sm",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-3.5"
      )}
    >
      {dashboardTitle || dashboardSubtitle ? (
        <div className={clsx("px-0.5", compact ? "mb-1.5" : "mb-2")}>
          {dashboardTitle ? (
            <h2 className={clsx("font-bold text-foreground", compact ? "text-sm" : "text-base")}>{dashboardTitle}</h2>
          ) : null}
          {dashboardSubtitle ? (
            <p className={clsx("text-muted-foreground", compact ? "text-[10px] leading-snug" : "text-[11px]")}>
              {dashboardSubtitle}
            </p>
          ) : null}
        </div>
      ) : null}

      {bucketGroups && bucketGroups.length > 0 ? (
        <div className={clsx("space-y-2.5", compact ? "sm:space-y-3" : "sm:space-y-3.5")}>
          {bucketGroups.map((group) => {
            const tiles = renderTiles(group.bucketKeys).filter(Boolean);
            if (tiles.length === 0) return null;
            const accent = GROUP_ACCENT[group.id] ?? GROUP_ACCENT.archives;
            return (
              <div
                key={group.id}
                className={clsx(
                  "rounded-xl border p-2 ring-1 sm:p-2.5",
                  accent.shell
                )}
              >
                <div className="mb-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={clsx(
                          "inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                          accent.badge
                        )}
                      >
                        {group.label}
                      </span>
                      <StatGroupHelp group={group} buckets={buckets} />
                    </div>
                    {group.subtitle ? (
                      <p className={clsx("mt-1 text-[10px] leading-snug", accent.label)}>{group.subtitle}</p>
                    ) : null}
                  </div>
                </div>
                <div className={clsx("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", compact ? "gap-1.5" : "gap-2")}>
                  {tiles}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={clsx("grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4", compact ? "gap-1.5" : "gap-2")}>
          {buckets.map((b) => (
            <StatBucketTile
              key={b.key}
              bucket={b}
              rows={rows}
              max={max}
              compact={compact}
              onOpen={openBucket}
            />
          ))}
        </div>
      )}
    </div>
  );
}
