"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  partitionClosedRequestProductLines,
  type ClosedLinePartitionInput,
} from "@/lib/closed-request-line-buckets";

type Props<T extends ClosedLinePartitionInput> = {
  items: T[];
  renderLine: (row: T, opts: { variant: "recupere" | "autre" | "ecarte" | "nonRetenu" }) => ReactNode;
};

function ClosedBucketSection({
  title,
  titleClass,
  count,
  collapsible,
  children,
}: {
  title: string;
  titleClass: string;
  count: number;
  collapsible?: boolean;
  children: ReactNode;
}) {
  const titleEl = (
    <h3 className={`text-[13px] font-extrabold uppercase tracking-wide sm:text-sm ${titleClass}`}>
      {title}
      <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
    </h3>
  );

  if (collapsible) {
    return (
      <details className="group w-full min-w-0 space-y-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-0.5 marker:content-none [&::-webkit-details-marker]:hidden">
          {titleEl}
          <ChevronDown className="size-3.5 shrink-0 opacity-80 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="pt-1">{children}</div>
      </details>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-2">
      {titleEl}
      {children}
    </section>
  );
}

/** Dossier clôturé pharmacien : même découpage et présentation que côté patient. */
export function PharmacistClosedProductBucketsView<T extends ClosedLinePartitionInput>({
  items,
  renderLine,
}: Props<T>) {
  const { recuperes, nonRetenues, ecartes, autresRetenus } = partitionClosedRequestProductLines(items);

  return (
    <div className="space-y-4">
      {recuperes.length > 0 ? (
        <ClosedBucketSection title="Produits récupérés" titleClass="text-emerald-950" count={recuperes.length}>
          <ul className="flex w-full min-w-0 flex-col divide-y divide-border/50 overflow-visible">
            {recuperes.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "recupere" })}
              </li>
            ))}
          </ul>
        </ClosedBucketSection>
      ) : null}

      {autresRetenus.length > 0 ? (
        <ClosedBucketSection title="Autres produits retenus" titleClass="text-slate-800" count={autresRetenus.length}>
          <ul className="flex w-full min-w-0 flex-col divide-y divide-border/50 overflow-visible">
            {autresRetenus.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "autre" })}
              </li>
            ))}
          </ul>
        </ClosedBucketSection>
      ) : null}

      {nonRetenues.length > 0 ? (
        <ClosedBucketSection
          title="Produits non retenus"
          titleClass="text-slate-700"
          count={nonRetenues.length}
          collapsible
        >
          <ul className="flex w-full min-w-0 flex-col divide-y divide-border/50 overflow-visible">
            {nonRetenues.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "nonRetenu" })}
              </li>
            ))}
          </ul>
        </ClosedBucketSection>
      ) : null}

      {ecartes.length > 0 ? (
        <ClosedBucketSection
          title="Écartés après validation"
          titleClass="text-amber-950"
          count={ecartes.length}
          collapsible
        >
          <ul className="flex w-full min-w-0 flex-col divide-y divide-border/50 overflow-visible">
            {ecartes.map((row) => (
              <li key={row.id} className="list-none">
                {renderLine(row, { variant: "ecarte" })}
              </li>
            ))}
          </ul>
        </ClosedBucketSection>
      ) : null}
    </div>
  );
}
