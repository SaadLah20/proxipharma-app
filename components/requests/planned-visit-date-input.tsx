"use client";

import { clsx } from "clsx";
import { Calendar } from "lucide-react";
import { formatYmdFrDdMmYy } from "@/lib/datetime-fr";

type Props = {
  valueYmd: string;
  onChangeYmd: (ymd: string) => void;
  minYmd: string;
  maxYmd: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
};

const shellClass =
  "block min-h-[2.75rem] w-full rounded-lg border-2 border-input bg-background px-2 py-2 text-[13px] font-semibold tabular-nums shadow-inner";

/** Même apparence qu’un `<input type="date">` : calendrier natif, libellé jj/mm/aa. */
export function PlannedVisitDateInput({
  valueYmd,
  onChangeYmd,
  minYmd,
  maxYmd,
  disabled = false,
  required = false,
  className,
  id,
}: Props) {
  const display = formatYmdFrDdMmYy(valueYmd);

  if (disabled) {
    return (
      <div
        id={id}
        lang="fr-FR"
        className={clsx(shellClass, "cursor-default opacity-90", className)}
        aria-label={display ? `Date de passage ${display}` : "Date de passage"}
      >
        {display || "—"}
      </div>
    );
  }

  return (
    <div lang="fr-FR" className={clsx("relative min-w-0 flex-1", className)}>
      <div aria-hidden className={clsx(shellClass, "pointer-events-none pr-9")}>
        {display ? (
          display
        ) : (
          <span className="font-medium text-muted-foreground">jj/mm/aa</span>
        )}
      </div>
      <input
        id={id}
        type="date"
        lang="fr-FR"
        min={minYmd}
        max={maxYmd}
        value={valueYmd}
        onChange={(e) => onChangeYmd(e.target.value)}
        required={required}
        aria-label="Date de passage"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-muted-foreground/70"
      >
        <Calendar className="size-4" strokeWidth={2} />
      </span>
    </div>
  );
}
