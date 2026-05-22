"use client";

import { clsx } from "clsx";

const PRESETS = ["09:00", "13:00", "15:00", "21:00"] as const;

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8);

export function PharmacySimpleTimeInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [hourPart, minutePart] = value?.includes(":") ? value.split(":") : ["", ""];

  return (
    <div className={clsx("space-y-1.5", disabled && "opacity-50")}>
      <p className="text-[11px] font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((t) => (
          <button
            key={t}
            type="button"
            disabled={disabled}
            className={clsx(
              "min-h-9 min-w-[3.25rem] rounded-lg border px-2 text-xs font-bold tabular-nums",
              value === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground"
            )}
            onClick={() => onChange(t)}
          >
            {t.replace(":", "h")}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <select
          aria-label={`${label} — heure`}
          disabled={disabled}
          className="h-10 flex-1 rounded-lg border border-input bg-background px-2 text-sm font-medium"
          value={hourPart || ""}
          onChange={(e) => {
            const h = e.target.value;
            const m = minutePart || "00";
            onChange(h ? `${h.padStart(2, "0")}:${m}` : "");
          }}
        >
          <option value="">Heure</option>
          {HOURS.map((h) => (
            <option key={h} value={String(h).padStart(2, "0")}>
              {h}h
            </option>
          ))}
        </select>
        <select
          aria-label={`${label} — minutes`}
          disabled={disabled}
          className="h-10 w-20 rounded-lg border border-input bg-background px-2 text-sm font-medium"
          value={minutePart || ""}
          onChange={(e) => {
            const m = e.target.value;
            const h = hourPart || "09";
            onChange(m ? `${h.padStart(2, "0")}:${m}` : "");
          }}
        >
          <option value="">Min</option>
          <option value="00">00</option>
          <option value="30">30</option>
        </select>
      </div>
    </div>
  );
}
