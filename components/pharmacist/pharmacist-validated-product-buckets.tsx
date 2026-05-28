"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronDown, Layers, Package, ShoppingCart } from "lucide-react";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import {
  type PharmacistValidatedBucketGroup,
  type PharmacistValidatedBucketKind,
} from "@/lib/pharmacist-validated-bucket-layout";

export function pharmacistValidatedSectionShellClass(kind: PharmacistValidatedBucketKind): string {
  switch (kind) {
    case "sky_reserve":
    case "sky_nonretenus":
      return "rounded-xl border-2 border-sky-300/90 bg-sky-50/35 p-2 ring-1 ring-sky-200/60";
    case "teal_order":
      return "rounded-xl border-2 border-teal-400/85 bg-teal-50/40 p-2 ring-1 ring-teal-200/65";
    case "amber_hors":
      return "rounded-xl border border-amber-200/80 bg-amber-50/25 p-2 ring-1 ring-amber-100/60";
    case "red_ecart":
      return "rounded-xl border border-red-200/85 bg-red-50/30 ring-1 ring-red-100/70";
    default:
      return "rounded-xl border border-border/80 bg-card p-2";
  }
}

function SectionIcon({ kind }: { kind: PharmacistValidatedBucketKind }) {
  if (kind === "teal_order") return <ShoppingCart className="size-4 shrink-0 text-teal-800" aria-hidden />;
  if (kind === "amber_hors" || kind === "red_ecart")
    return <Layers className="size-4 shrink-0 text-amber-800" aria-hidden />;
  return <Package className="size-4 shrink-0 text-sky-700" aria-hidden />;
}

function BucketBlock<T extends PatientLineLike>({
  group,
  renderRow,
}: {
  group: PharmacistValidatedBucketGroup<T>;
  renderRow: (row: T) => ReactNode;
}) {
  const titleColor =
    group.kind === "teal_order"
      ? "text-teal-950"
      : group.kind === "amber_hors"
        ? "text-amber-950"
        : group.kind === "red_ecart"
          ? "text-red-950"
          : "text-sky-950";

  const rowList = <ul className="space-y-2.5">{group.rows.map((row) => renderRow(row))}</ul>;

  const openHeader = (
    <>
      <div className={clsx("flex flex-nowrap items-center justify-between gap-2 overflow-x-auto px-0.5", titleColor)}>
        <div className="flex min-w-0 items-center gap-1.5">
          <SectionIcon kind={group.kind} />
          <h4 className="min-w-0 text-[10px] font-extrabold uppercase leading-snug tracking-wide sm:text-[11px]">
            {group.title}
          </h4>
        </div>
        {group.totalLabel ? (
          <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums opacity-90">
            {group.totalLabel}
          </p>
        ) : null}
      </div>
      {group.hint ? (
        <p className="px-0.5 text-[9px] leading-snug text-muted-foreground">{group.hint}</p>
      ) : null}
      {rowList}
    </>
  );

  if (group.collapsible) {
    return (
      <details className={clsx("group", pharmacistValidatedSectionShellClass(group.kind))}>
        <summary
          className={clsx(
            "flex cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-1 [&::-webkit-details-marker]:hidden",
            titleColor
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <SectionIcon kind={group.kind} />
            <span className="text-[11px] font-extrabold uppercase tracking-wide">{group.title}</span>
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 opacity-80 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="mt-2 space-y-2 border-t border-current/15 pt-2 px-0.5">
          {group.hint ? (
            <p className="text-[9px] leading-snug text-muted-foreground">{group.hint}</p>
          ) : null}
          {rowList}
        </div>
      </details>
    );
  }

  return <section className={clsx("space-y-2", pharmacistValidatedSectionShellClass(group.kind))}>{openHeader}</section>;
}

export function PharmacistValidatedProductBuckets<T extends PatientLineLike>({
  groups,
  sectionTitle = "Produits de la commande validée",
  renderRow,
}: {
  groups: PharmacistValidatedBucketGroup<T>[];
  sectionTitle?: string;
  renderRow: (row: T) => ReactNode;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Aucune ligne produit à afficher.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{sectionTitle}</h3>
      {groups.map((group) => (
        <BucketBlock key={group.kind} group={group} renderRow={renderRow} />
      ))}
    </div>
  );
}
