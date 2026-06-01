"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import type {
  PharmacistValidatedBucketGroup,
  PharmacistValidatedBucketKind,
} from "@/lib/pharmacist-validated-bucket-layout";

export function pharmacistValidatedBucketHeaderClass(kind: PharmacistValidatedBucketKind): string {
  switch (kind) {
    case "teal_order":
      return "text-teal-950";
    case "amber_hors":
      return "text-amber-950";
    case "red_ecart":
      return "text-red-950";
    default:
      return "text-sky-950";
  }
}

/** Titre de groupe seul (couleur sémantique) — lignes en liste `divide-y`, aligné patient. */
export function PharmacistValidatedBucketSection({
  group,
  children,
}: {
  group: Pick<PharmacistValidatedBucketGroup<unknown>, "kind" | "title" | "hint" | "totalLabel" | "collapsible" | "rows">;
  children: ReactNode;
}) {
  const titleColor = pharmacistValidatedBucketHeaderClass(group.kind);
  const count = group.rows.length;

  const titleBlock = (
    <div className="flex flex-nowrap items-baseline justify-between gap-2 px-0.5">
      <h4
        className={clsx(
          "min-w-0 text-[13px] font-extrabold uppercase tracking-wide sm:text-sm",
          titleColor
        )}
      >
        {group.title}
        <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
      </h4>
      {group.totalLabel ? (
        <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
          {group.totalLabel}
        </p>
      ) : null}
    </div>
  );

  if (group.collapsible) {
    return (
      <details className="group w-full min-w-0 space-y-2">
        <summary
          className={clsx(
            "flex cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-0.5 [&::-webkit-details-marker]:hidden",
            titleColor
          )}
        >
          <span className={clsx("text-[13px] font-extrabold uppercase tracking-wide sm:text-sm", titleColor)}>
            {group.title}
            <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
          </span>
          <ChevronDown
            className="size-3.5 shrink-0 opacity-80 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-2 pt-1">
          {group.hint ? (
            <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">{group.hint}</p>
          ) : null}
          {children}
        </div>
      </details>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-2">
      {titleBlock}
      {group.hint ? (
        <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">{group.hint}</p>
      ) : null}
      {children}
    </section>
  );
}
