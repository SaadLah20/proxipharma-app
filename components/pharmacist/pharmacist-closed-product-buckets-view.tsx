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
  patientClosedArchiveBucketHeaderBarClass,
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

function closedBucketHeaderClass(id: ClosedBucketKey): string {
  if (id === "autres_retenus") {
    return "rounded-lg border border-border/80 border-l-[3px] border-l-slate-400/75 bg-card px-2.5 py-1.5 shadow-none";
  }
  return clsx("rounded-lg px-2.5 py-1.5", patientClosedArchiveBucketHeaderBarClass(id));
}

function closedBucketShellClass(id: ClosedBucketKey): string {
  if (id === "autres_retenus") {
    return "rounded-lg border border-border/80 border-l-[3px] border-l-slate-400/75 bg-card shadow-none";
  }
  return clsx("rounded-lg", patientClosedArchiveBucketSectionShellClass(id));
}

function closedBucketAccent(id: ClosedBucketKey): string {
  if (id === "autres_retenus") return "text-muted-foreground";
  return patientClosedArchiveBucketAccentTextClass(id);
}

function ClosedArchiveBucketSection({
  bucketId,
  count,
  collapsible,
  children,
}: {
  bucketId: ClosedBucketKey;
  count: number;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const Icon = BUCKET_ICONS[bucketId];
  const title = closedBucketTitle(bucketId);
  const accentText = closedBucketAccent(bucketId);

  const headerInner = (
    <>
      <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
      <h4 className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-foreground sm:text-[13px]">
        {title}
      </h4>
      <span
        className={clsx(
          "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
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
      <details className="group w-full min-w-0 space-y-1" aria-label={closedBucketAria(bucketId)}>
        <summary className="flex min-w-0 cursor-pointer list-none items-center gap-x-2 [&::-webkit-details-marker]:hidden">
          <div
            className={clsx(
              "flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1",
              closedBucketHeaderClass(bucketId)
            )}
          >
            {headerInner}
          </div>
        </summary>
        <div className={clsx("overflow-hidden", closedBucketShellClass(bucketId))}>{children}</div>
      </details>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-1" aria-label={closedBucketAria(bucketId)}>
      <div
        className={clsx(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
          closedBucketHeaderClass(bucketId)
        )}
      >
        {headerInner}
      </div>
      <div className={clsx("overflow-hidden", closedBucketShellClass(bucketId))}>{children}</div>
    </section>
  );
}

/** Dossier clôturé pharmacien — présentation alignée archive patient. */
export function PharmacistClosedProductBucketsView<T extends ClosedLinePartitionInput>({
  items,
  renderLine,
}: {
  items: T[];
  renderLine: (row: T, opts: { variant: "recupere" | "autre" | "ecarte" | "nonRetenu" }) => ReactNode;
}) {
  const { recuperes, nonRetenues, ecartes, autresRetenus } = partitionClosedRequestProductLines(items);

  const listClass = patientBucketProductListClass;

  return (
    <div className="space-y-3">
      {recuperes.length > 0 ? (
        <ClosedArchiveBucketSection bucketId="recuperes" count={recuperes.length}>
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
        <ClosedArchiveBucketSection bucketId="ecartes" count={ecartes.length} collapsible>
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
