"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  title: string;
  count: number;
  titleClassName?: string;
  hint?: string | null;
  /** Accent discret sur le bloc replié. */
  variant?: "neutral" | "attention" | "withdrawn";
  children: ReactNode;
};

const VARIANT_SHELL: Record<NonNullable<Props["variant"]>, string> = {
  neutral: "border border-border/80 bg-muted/15",
  attention: "border border-border/80 border-l-[3px] border-l-red-400/65 bg-muted/15",
  withdrawn: "border border-border/80 border-l-[3px] border-l-amber-500/65 bg-muted/15",
};

/** Section repliée archive (non retenus, écarts…) — alignée parcours actif. */
export function PatientArchiveCollapsibleSection({
  title,
  count,
  titleClassName,
  hint,
  variant = "neutral",
  children,
}: Props) {
  return (
    <details className={clsx("group w-full min-w-0 rounded-lg", VARIANT_SHELL[variant])}>
      <summary
        className={clsx(
          "flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 [&::-webkit-details-marker]:hidden",
          titleClassName ?? "text-foreground"
        )}
      >
        <span className="text-[12px] font-bold leading-none">
          {title}
          <span className="ml-1.5 tabular-nums font-semibold text-muted-foreground">({count})</span>
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="space-y-2 border-t border-border/60 px-1 pb-1.5 pt-1.5">
        {hint ? <p className="px-1 text-[10px] leading-snug text-muted-foreground">{hint}</p> : null}
        {children}
      </div>
    </details>
  );
}
