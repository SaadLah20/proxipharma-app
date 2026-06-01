"use client";

import type { ReactNode } from "react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";

export function ScheduleConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Annuler",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <AppModalOverlay open={open} onBackdropClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-4 shadow-xl"
      >
        <h2 id="schedule-dialog-title" className="text-base font-bold text-foreground">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
