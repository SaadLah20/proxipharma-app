"use client";

import type { ReactNode } from "react";
import { ChevronDown, Package } from "lucide-react";
import {
  partitionClosedRequestProductLines,
  type ClosedLinePartitionInput,
} from "@/lib/closed-request-line-buckets";

type Props<T extends ClosedLinePartitionInput> = {
  items: T[];
  renderLine: (row: T, opts: { variant: "recupere" | "autre" | "ecarte" | "nonRetenu" }) => ReactNode;
};

/** Dossier clôturé pharmacien : même découpage que côté patient. */
export function PharmacistClosedProductBucketsView<T extends ClosedLinePartitionInput>({
  items,
  renderLine,
}: Props<T>) {
  const { recuperes, nonRetenues, ecartes, autresRetenus } = partitionClosedRequestProductLines(items);

  return (
    <div className="space-y-3">
      {recuperes.length > 0 ? (
        <section className="rounded-xl border-2 border-emerald-300/80 bg-gradient-to-b from-emerald-50/55 via-white to-white p-2.5 shadow-md ring-1 ring-emerald-200/60 sm:p-3">
          <div className="mb-2 flex items-center gap-1.5 text-emerald-950">
            <Package className="size-4 shrink-0 text-emerald-700" aria-hidden />
            <h3 className="text-[11px] font-bold uppercase tracking-wide">
              Produits récupérés ({recuperes.length})
            </h3>
          </div>
          <ul className="flex flex-col gap-2">
            {recuperes.map((row) => (
              <li key={row.id}>{renderLine(row, { variant: "recupere" })}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {autresRetenus.length > 0 ? (
        <section className="rounded-xl border border-slate-200/80 bg-slate-50/40 p-2 opacity-90">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
            Autres produits retenus ({autresRetenus.length})
          </h3>
          <ul className="mt-1.5 flex flex-col gap-2">
            {autresRetenus.map((row) => (
              <li key={row.id}>{renderLine(row, { variant: "autre" })}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {nonRetenues.length > 0 ? (
        <details className="group rounded-xl border border-slate-200/70 bg-slate-50/30 opacity-80">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Produits non retenus ({nonRetenues.length})</span>
            <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="flex flex-col gap-2 border-t border-slate-200/60 px-2 py-1.5">
            {nonRetenues.map((row) => (
              <li key={row.id}>{renderLine(row, { variant: "nonRetenu" })}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {ecartes.length > 0 ? (
        <details className="group rounded-xl border border-amber-200/60 bg-amber-50/20 opacity-85">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold text-amber-950 marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Produits écartés après validation ({ecartes.length})</span>
            <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="flex flex-col gap-2 border-t border-amber-200/50 px-2 py-1.5">
            {ecartes.map((row) => (
              <li key={row.id}>{renderLine(row, { variant: "ecarte" })}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
