"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Ban, CheckCircle2, ChevronDown, Package } from "lucide-react";
import { clsx } from "clsx";
import {
  partitionClosedRequestProductLines,
  type ClosedLinePartitionInput,
} from "@/lib/closed-request-line-buckets";
import {
  type PatientClosedArchiveLineBucketId,
  patientClosedArchiveBucketAccentTextClass,
  patientClosedArchiveBucketAriaTitleFr,
  patientClosedArchiveBucketCountBadgeClass,
  patientClosedArchiveBucketSectionShellClass,
  patientClosedArchiveBucketTitleFr,
} from "@/lib/patient-closed-archive-line-buckets";
import { patientBucketProductListClass } from "@/lib/patient-bucket-product-row-ui";

type ClosedBucketKey = PatientClosedArchiveLineBucketId | "autres_retenus";

const BUCKET_ICONS: Record<ClosedBucketKey, LucideIcon> = {
  recuperes: CheckCircle2,
  ecartes: Ban,
  non_retenus: Package,
  autres_retenus: Package,
};

function closedBucketTitle(id: ClosedBucketKey): string {
  if (id === "autres_retenus") return "Autres retenus";
  return patientClosedArchiveBucketTitleFr(id);
}

function closedBucketAria(id: ClosedBucketKey): string {
  if (id === "autres_retenus") return "Produits retenus non récupérés au comptoir";
  return patientClosedArchiveBucketAriaTitleFr(id);
}

function closedBucketShellClass(id: ClosedBucketKey): string {
  if (id === "autres_retenus") {
    return "border border-border/80 border-l-[3px] border-l-slate-400/75 bg-card shadow-none";
  }
  return patientClosedArchiveBucketSectionShellClass(id);
}

function closedBucketAccent(id: ClosedBucketKey): string {
  if (id === "autres_retenus") return "text-muted-foreground";
  return patientClosedArchiveBucketAccentTextClass(id);
}

function ClosedArchiveBucketSection({
  bucketId,
  count,
  subtotalLabel,
  collapsible,
  hint,
  children,
}: {
  bucketId: ClosedBucketKey;
  count: number;
  subtotalLabel?: string | null;
  collapsible?: boolean;
  hint?: string | null;
  children: ReactNode;
}) {
  const Icon = BUCKET_ICONS[bucketId];
  const title = closedBucketTitle(bucketId);
  const accentText = closedBucketAccent(bucketId);
  const outerShellClass = clsx("w-full min-w-0 overflow-hidden rounded-lg", closedBucketShellClass(bucketId));
  const headerRowClass =
    "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/55 px-2.5 py-2";

  const headerInner = (
    <>
      <Icon className={clsx("size-4 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
      <h4 className="min-w-0 flex-1 truncate text-[13px] font-bold leading-tight text-foreground sm:text-[15px]">
        {title}
      </h4>
      {subtotalLabel ? (
        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-muted-foreground sm:text-[12px]">
          {subtotalLabel}
        </span>
      ) : null}
      <span
        className={clsx(
          "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1",
          patientClosedArchiveBucketCountBadgeClass()
        )}
      >
        {count}
      </span>
      {collapsible ? (
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (collapsible) {
    return (
      <details className={clsx("group", outerShellClass)} aria-label={closedBucketAria(bucketId)}>
        <summary
          className={clsx(headerRowClass, "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}
        >
          {headerInner}
        </summary>
        {hint ? (
          <p className="border-b border-border/45 px-2.5 py-1 text-[10px] leading-snug text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {children}
      </details>
    );
  }

  return (
    <section className={outerShellClass} aria-label={closedBucketAria(bucketId)}>
      <div className={headerRowClass}>{headerInner}</div>
      {hint ? (
        <p className="border-b border-border/45 px-2.5 py-1 text-[10px] leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children}
    </section>
  );
}

/** Dossier clôturé pharmacien — présentation alignée archive patient. */
export function PharmacistClosedProductBucketsView<T extends ClosedLinePartitionInput>({
  items,
  renderLine,
  recuperesSubtotalLabel,
}: {
  items: T[];
  renderLine: (row: T, opts: { variant: "recupere" | "autre" | "ecarte" | "nonRetenu" }) => ReactNode;
  recuperesSubtotalLabel?: string | null;
}) {
  const { recuperes, nonRetenues, ecartes, autresRetenus } = partitionClosedRequestProductLines(items);

  const listClass = patientBucketProductListClass;

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="space-y-1 px-0">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">
          Produits archivés
        </h3>
        <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
          État enregistré au moment de la clôture — consultation seule.
        </p>
      </div>

      {recuperes.length > 0 ? (
        <ClosedArchiveBucketSection
          bucketId="recuperes"
          count={recuperes.length}
          subtotalLabel={recuperesSubtotalLabel}
        >
          <ul className={listClass}>
            {recuperes.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "recupere" })}
              </li>
            ))}
          </ul>
        </ClosedArchiveBucketSection>
      ) : null}

      {autresRetenus.length > 0 ? (
        <ClosedArchiveBucketSection bucketId="autres_retenus" count={autresRetenus.length}>
          <ul className={listClass}>
            {autresRetenus.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "autre" })}
              </li>
            ))}
          </ul>
        </ClosedArchiveBucketSection>
      ) : null}

      {nonRetenues.length > 0 ? (
        <ClosedArchiveBucketSection bucketId="non_retenus" count={nonRetenues.length} collapsible>
          <ul className={listClass}>
            {nonRetenues.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "nonRetenu" })}
              </li>
            ))}
          </ul>
        </ClosedArchiveBucketSection>
      ) : null}

      {ecartes.length > 0 ? (
        <ClosedArchiveBucketSection
          bucketId="ecartes"
          count={ecartes.length}
          collapsible
          hint="Produits non récupérés ou retirés par la pharmacie."
        >
          <ul className={listClass}>
            {ecartes.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "ecarte" })}
              </li>
            ))}
          </ul>
        </ClosedArchiveBucketSection>
      ) : null}
    </div>
  );
}
