"use client";

import { clsx } from "clsx";
import { useCallback, useId, useRef, useState } from "react";

type Props = {
  hour: string;
  minute: string;
  onHourChange: (v: string) => void;
  onMinuteChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
};

function clampHour(raw: string): string {
  if (raw === "") return "";
  const n = Math.min(23, Math.max(0, parseInt(raw, 10) || 0));
  return String(n);
}

/** Pendant la saisie : 1 chiffre tel quel (« 3 ») ; à 2 chiffres ou au blur : clamp + pad. */
function normalizeMinuteDigits(digits: string, padSingle = false): string {
  if (digits.length === 0) return "";
  if (digits.length === 1 && !padSingle) return digits;
  const n = Math.min(59, Math.max(0, parseInt(digits, 10) || 0));
  return String(n).padStart(2, "0");
}

export function PlannedVisitTimeInput({
  hour,
  minute,
  onHourChange,
  onMinuteChange,
  disabled = false,
  className,
}: Props) {
  const hourRef = useRef<HTMLInputElement>(null);
  const minuteRef = useRef<HTMLInputElement>(null);
  const hourId = useId();
  const minuteId = useId();
  const [focusSeg, setFocusSeg] = useState<"hour" | "minute" | null>(null);

  const focusMinute = useCallback(() => {
    minuteRef.current?.focus();
    minuteRef.current?.select();
  }, []);

  const focusHour = useCallback(() => {
    hourRef.current?.focus();
    hourRef.current?.select();
  }, []);

  const onHourInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (digits.length === 0) {
      onHourChange("");
      return;
    }
    if (digits.length === 1) {
      onHourChange(digits);
      return;
    }
    onHourChange(clampHour(digits));
    focusMinute();
  };

  const onMinuteInput = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (digits.length === 0) {
      onMinuteChange("");
      return;
    }
    onMinuteChange(normalizeMinuteDigits(digits, false));
  };

  const onMinuteBlur = () => {
    if (minute.length === 1) {
      onMinuteChange(normalizeMinuteDigits(minute, true));
    }
  };

  const segmentClass = (active: boolean) =>
    clsx(
      "flex min-w-0 flex-1 flex-col rounded-lg border-2 bg-background px-2 py-1.5 shadow-inner transition",
      active ? "border-primary/50 ring-1 ring-primary/25" : "border-input",
      disabled && "cursor-default opacity-90"
    );

  return (
    <div className={clsx("grid grid-cols-2 gap-2", className)}>
      <div
        className={segmentClass(focusSeg === "hour")}
        onClick={() => !disabled && focusHour()}
        role="presentation"
      >
        <label htmlFor={hourId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Heures
        </label>
        <input
          ref={hourRef}
          id={hourId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="18"
          maxLength={2}
          disabled={disabled}
          value={hour}
          onChange={(e) => onHourInput(e.target.value)}
          onFocus={(e) => {
            setFocusSeg("hour");
            e.target.select();
          }}
          onBlur={() => setFocusSeg((s) => (s === "hour" ? null : s))}
          className="mt-0.5 w-full border-0 bg-transparent p-0 text-center text-[15px] font-bold tabular-nums text-foreground focus:outline-none"
        />
      </div>
      <div
        className={segmentClass(focusSeg === "minute")}
        onClick={() => !disabled && focusMinute()}
        role="presentation"
      >
        <label htmlFor={minuteId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          Minutes
        </label>
        <input
          ref={minuteRef}
          id={minuteId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="00"
          maxLength={2}
          disabled={disabled}
          value={minute}
          onChange={(e) => onMinuteInput(e.target.value)}
          onFocus={(e) => {
            setFocusSeg("minute");
            e.target.select();
          }}
          onBlur={() => {
            onMinuteBlur();
            setFocusSeg((s) => (s === "minute" ? null : s));
          }}
          className="mt-0.5 w-full border-0 bg-transparent p-0 text-center text-[15px] font-bold tabular-nums text-foreground focus:outline-none"
        />
      </div>
    </div>
  );
}
