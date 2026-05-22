"use client";

import { useEffect } from "react";
import { clsx } from "clsx";
import { X } from "lucide-react";

export type ScheduleToastTone = "info" | "success" | "warning" | "error";

export function ScheduleToast({
  message,
  tone = "info",
  onDismiss,
  autoHideMs = 6000,
}: {
  message: string;
  tone?: ScheduleToastTone;
  onDismiss: () => void;
  autoHideMs?: number;
}) {
  useEffect(() => {
    if (!message || autoHideMs <= 0) return;
    const t = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(t);
  }, [message, autoHideMs, onDismiss]);

  if (!message) return null;

  const tones: Record<ScheduleToastTone, string> = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    error: "border-red-200 bg-red-50 text-red-950",
  };

  return (
    <div
      role="status"
      className={clsx(
        "flex items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm shadow-sm",
        tones[tone]
      )}
    >
      <p className="leading-snug">{message}</p>
      <button
        type="button"
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Fermer"
        onClick={onDismiss}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
