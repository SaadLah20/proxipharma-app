"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  title: string;
  count: number;
  titleClassName?: string;
  hint?: string | null;
  children: ReactNode;
};

/** Section repliée archive (non retenus, écarts…) — style neutre aligné parcours actif. */
export function PatientArchiveCollapsibleSection({
  title,
  count,
  titleClassName,
  hint,
  children,
}: Props) {
  return (
    <details className="group w-full min-w-0">
      <summary
        className={clsx(
          "flex cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-1 [&::-webkit-details-marker]:hidden",
          titleClassName ?? "text-muted-foreground"
        )}
      >
        <span className="text-[13px] font-bold uppercase tracking-wide">
          {title}
          <span className="ml-1.5 tabular-nums opacity-75">({count})</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="space-y-2 pt-1">
        {hint ? <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
        {children}
      </div>
    </details>
  );
}
