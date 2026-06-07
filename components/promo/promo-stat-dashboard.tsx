"use client";

import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Ban,
  CheckCircle2,
  CircleCheck,
  Gift,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { InfoHint } from "@/components/ui/info-hint";
import {
  patientPromoHubDashboardShellClass,
  patientPromoHubStatGroupAccent,
  type PatientPromoHubDashboardAccent,
} from "@/lib/patient-promo-hub-dashboard-ui";
import {
  countInPromoBucket,
  type PromoStatBucket,
  type PromoStatBucketGroup,
  type PromoStatBucketKey,
} from "@/lib/promo/reservation-hub-buckets";

const BUCKET_ICONS: Record<PromoStatBucketKey, LucideIcon> = {
  soumise: Send,
  confirmee: CheckCircle2,
  recuperee: CircleCheck,
  indisponible: XCircle,
  annulee: Ban,
};

type Row = { status: string };

const PHARMA_GROUP_ACCENT: Record<string, { shell: string; label: string; badge: string }> = {
  a_suivre: {
    shell: "border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.06] ring-primary/15",
    label: "text-foreground",
    badge: "bg-primary/10 text-primary",
  },
  archives: {
    shell: "border-border/60 bg-muted/15 ring-border/40",
    label: "text-muted-foreground",
    badge: "bg-muted text-muted-foreground",
  },
};

function StatBucketTile({
  bucket,
  rows,
  max,
  compact,
  onOpen,
  hubAccent,
}: {
  bucket: PromoStatBucket;
  rows: Row[];
  max: number;
  compact: boolean;
  onOpen: (key: PromoStatBucketKey) => void;
  hubAccent?: PatientPromoHubDashboardAccent | null;
}) {
  const n = countInPromoBucket(rows, bucket);
  const pct = Math.round((n / max) * 100);
  const Icon = BUCKET_ICONS[bucket.key];

  return (
    <button
      type="button"
      onClick={() => onOpen(bucket.key)}
      className={clsx(
        "flex flex-col rounded-lg border bg-card text-left shadow-sm ring-1 transition",
        hubAccent === "emerald"
          ? "border-emerald-200/50 ring-emerald-100/25 hover:border-emerald-300/50 hover:shadow-md focus-visible:ring-emerald-200/40"
          : "border-border/90 ring-black/[0.03] hover:border-primary/35 hover:shadow-md focus-visible:ring-ring",
        compact ? "min-h-[5.5rem] p-2" : "min-h-[118px] rounded-xl p-2.5",
        "focus-visible:outline-none focus-visible:ring-2",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-md",
            hubAccent === "emerald"
              ? "bg-emerald-100/75 text-emerald-800"
              : "bg-primary/10 text-primary",
            compact ? "size-7" : "size-8",
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
          className={clsx(
            "h-full rounded-full transition-[width]",
            hubAccent === "emerald" ? "bg-emerald-500/45" : "bg-primary/60",
          )}
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
    </button>
  );
}

function StatGroupHelp({
  group,
  buckets,
}: {
  group: PromoStatBucketGroup;
  buckets: PromoStatBucket[];
}) {
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));
  return (
    <InfoHint label={`Aide — ${group.label}`} align="end" placement="down" className="shrink-0">
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

export function PromoStatDashboard({
  rows,
  buckets,
  basePath,
  density = "compact",
  dashboardTitle = "Réservations packs",
  dashboardSubtitle,
  bucketGroups,
  hubAccent = null,
}: {
  rows: Row[];
  buckets: PromoStatBucket[];
  basePath: string;
  density?: "default" | "compact";
  dashboardTitle?: string;
  dashboardSubtitle?: string;
  bucketGroups?: PromoStatBucketGroup[];
  hubAccent?: PatientPromoHubDashboardAccent | null;
}) {
  const router = useRouter();
  const max = Math.max(1, ...buckets.map((b) => countInPromoBucket(rows, b)));
  const compact = density === "compact";
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  const openBucket = (key: PromoStatBucketKey) => {
    const next = new URLSearchParams();
    next.set("vue", "liste");
    next.set("statut", key);
    next.set("filtres", "0");
    router.replace(`${basePath}?${next.toString()}`, { scroll: false });
  };

  const renderTiles = (keys: readonly PromoStatBucketKey[]) =>
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
          hubAccent={hubAccent}
        />
      );
    });

  return (
    <div
      className={clsx(
        "overflow-visible rounded-2xl border shadow-sm sm:shadow-sm",
        hubAccent
          ? patientPromoHubDashboardShellClass
          : "border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06]",
        compact ? "p-2.5 sm:p-3" : "p-3 sm:p-3.5",
      )}
    >
      {dashboardTitle || dashboardSubtitle ? (
        <div className={clsx("flex items-start gap-2 px-0.5", compact ? "mb-1.5" : "mb-2")}>
          <div className="min-w-0 flex-1">
            {dashboardTitle ? (
              <h2 className={clsx("font-bold text-foreground", compact ? "text-sm" : "text-base")}>{dashboardTitle}</h2>
            ) : null}
            {dashboardSubtitle ? (
              <p className={clsx("text-muted-foreground", compact ? "text-[10px] leading-snug" : "text-[11px]")}>
                {dashboardSubtitle}
              </p>
            ) : null}
          </div>
          <span
            className={clsx(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              hubAccent === "emerald" ? "bg-emerald-100/80 text-emerald-800" : "bg-primary/10 text-primary",
            )}
            aria-hidden
          >
            <Gift className="size-4" strokeWidth={2.25} />
          </span>
        </div>
      ) : null}

      {bucketGroups && bucketGroups.length > 0 ? (
        <div className={clsx("space-y-2.5", compact ? "sm:space-y-3" : "sm:space-y-3.5")}>
          {bucketGroups.map((group) => {
            const tiles = renderTiles(group.bucketKeys).filter(Boolean);
            if (tiles.length === 0) return null;
            const accent = hubAccent
              ? patientPromoHubStatGroupAccent(group.id)
              : (PHARMA_GROUP_ACCENT[group.id] ?? PHARMA_GROUP_ACCENT.archives);
            return (
              <div
                key={group.id}
                className={clsx("overflow-visible rounded-xl border p-2 ring-1 sm:p-2.5", accent.shell)}
              >
                <div className="mb-2 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0 flex-1">
                    <span
                      className={clsx(
                        "inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        accent.badge,
                      )}
                    >
                      {group.label}
                    </span>
                    {group.subtitle ? (
                      <p className={clsx("mt-1 text-[10px] leading-snug", accent.label)}>{group.subtitle}</p>
                    ) : null}
                  </div>
                  <StatGroupHelp group={group} buckets={buckets} />
                </div>
                <div className={clsx("grid grid-cols-2 sm:grid-cols-3", compact ? "gap-1.5" : "gap-2")}>
                  {tiles}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={clsx("grid grid-cols-2 sm:grid-cols-3", compact ? "gap-1.5" : "gap-2")}>
          {buckets.map((b) => (
            <StatBucketTile
              key={b.key}
              bucket={b}
              rows={rows}
              max={max}
              compact={compact}
              onOpen={openBucket}
              hubAccent={hubAccent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
