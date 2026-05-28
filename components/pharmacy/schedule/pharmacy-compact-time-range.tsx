"use client";

import { clsx } from "clsx";
import {
  pharmacyClosedCheckboxLabelClass,
  pharmacyClosedTimeRangeShellClass,
} from "@/lib/pharmacy-open-status-ui";

/** Créneau compact : case Fermé + deux champs time natifs (sans presets). */
export function PharmacyCompactTimeRange({
  periodLabel,
  closed,
  opensAt,
  closesAt,
  onClosedChange,
  onOpensChange,
  onClosesChange,
  disabled,
  className,
}: {
  periodLabel: string;
  closed: boolean;
  opensAt: string;
  closesAt: string;
  onClosedChange: (closed: boolean) => void;
  onOpensChange: (value: string) => void;
  onClosesChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "flex min-w-0 flex-col gap-1 rounded-lg border border-border/60 bg-background/90 px-2 py-1.5",
        disabled && "opacity-50",
        className
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
          {periodLabel}
        </span>
        <label className={pharmacyClosedCheckboxLabelClass(closed)}>
          <input
            type="checkbox"
            className="size-3.5 rounded border-input accent-rose-600"
            checked={closed}
            disabled={disabled}
            onChange={(e) => onClosedChange(e.target.checked)}
          />
          Fermé
        </label>
      </div>
      {!closed ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
          <input
            type="time"
            disabled={disabled}
            value={opensAt}
            onChange={(e) => onOpensChange(e.target.value)}
            className="h-9 w-full min-w-[4.5rem] rounded-md border border-input bg-background px-1 text-xs font-medium tabular-nums"
          />
          <span className="shrink-0 text-[10px] text-muted-foreground">→</span>
          <input
            type="time"
            disabled={disabled}
            value={closesAt}
            onChange={(e) => onClosesChange(e.target.value)}
            className="h-9 w-full min-w-[4.5rem] rounded-md border border-input bg-background px-1 text-xs font-medium tabular-nums"
          />
        </div>
      ) : null}
    </div>
  );
}
