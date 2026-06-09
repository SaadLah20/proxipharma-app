"use client";

import { clsx } from "clsx";
import { Calendar } from "lucide-react";
import { formatYmdFrDdMmYy, formatYmdFrDdMmYyyy } from "@/lib/datetime-fr";
import { receptionDateMaxYmd } from "@/lib/planned-visit";

type Props = {
  valueYmd: string;
  onChangeYmd: (ymd: string) => void;
  minYmd: string;
  maxYmd?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  className?: string;
  /** Style du libellé affiché (jj/mm/…). */
  shellClassName?: string;
  id?: string;
  /** 2 = jj/mm/aa (passage patient), 4 = jj/mm/aaaa (réception prévue). */
  yearDigits?: 2 | 4;
  ariaLabel?: string;
  placeholder?: string;
};

const defaultShellClass =
  "block min-h-[2.75rem] w-full rounded-lg border-2 border-input bg-background px-2 py-2 text-[13px] font-semibold tabular-nums shadow-inner";

/** Calendrier natif `type="date"` + libellé FR (jj/mm/aa ou jj/mm/aaaa), `lang="fr-FR"`. */
export function PlannedVisitDateInput({
  valueYmd,
  onChangeYmd,
  minYmd,
  maxYmd,
  disabled = false,
  required = false,
  invalid = false,
  className,
  shellClassName,
  id,
  yearDigits = 2,
  ariaLabel,
  placeholder,
}: Props) {
  const resolvedMax = maxYmd ?? receptionDateMaxYmd();
  const display =
    yearDigits === 4 ? formatYmdFrDdMmYyyy(valueYmd) : formatYmdFrDdMmYy(valueYmd);
  const placeholderText = placeholder ?? (yearDigits === 4 ? "jj/mm/aaaa" : "jj/mm/aa");
  const label = ariaLabel ?? (yearDigits === 4 ? "Réception prévue" : "Date de passage");
  const shell = shellClassName ?? defaultShellClass;

  if (disabled) {
    return (
      <div
        id={id}
        lang="fr-FR"
        className={clsx(shell, "cursor-default opacity-90", className)}
        aria-label={display ? `${label} ${display}` : label}
      >
        {display || "—"}
      </div>
    );
  }

  return (
    <div lang="fr-FR" className={clsx("relative min-w-0 flex-1", className)}>
      <div
        aria-hidden
        className={clsx(shell, "pointer-events-none pr-9", invalid && "border-destructive/60 ring-2 ring-destructive/20")}
      >
        {display ? (
          display
        ) : (
          <span className="font-medium text-muted-foreground">{placeholderText}</span>
        )}
      </div>
      <input
        id={id}
        type="date"
        lang="fr-FR"
        min={minYmd}
        max={resolvedMax}
        value={valueYmd}
        onChange={(e) => onChangeYmd(e.target.value)}
        required={required}
        aria-invalid={invalid || undefined}
        aria-label={label}
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
