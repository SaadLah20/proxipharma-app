"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { uiActionBtnModalOutline, uiActionBtnModalPrimary } from "@/lib/ui-action-buttons";

export type PharmacistCloseRequestSummary = {
  retainedCount: number;
  totalLines: number;
  notRetainedAtValidation: number;
  withdrawnAfterConfirm: number;
  pickedUpCount: number;
  pendingPickupCount: number;
  hasPartialPickupWarning: boolean;
};

type Props = {
  open: boolean;
  busy: boolean;
  summary: PharmacistCloseRequestSummary;
  onClose: () => void;
  onConfirm: () => void;
};

const noOpSubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(noOpSubscribe, () => true, () => false);
}

export function PharmacistCloseRequestConfirmModal({
  open,
  busy,
  summary,
  onClose,
  onConfirm,
}: Props) {
  const clientMounted = useClientMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  if (!open || !clientMounted) return null;

  return (
    <AppModalOverlay
      open={open}
      aria-labelledby="ph-close-request-title"
      onBackdropClick={() => {
        if (!busy) onClose();
      }}
    >
      <CloseRequestDialogPanel busy={busy} summary={summary} onClose={onClose} onConfirm={onConfirm} />
    </AppModalOverlay>
  );
}

function CloseRequestDialogPanel({
  busy,
  summary,
  onClose,
  onConfirm,
}: Omit<Props, "open" | "clientMounted">) {
  return (
    <div className="relative z-10 flex max-h-[min(92dvh,36rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Clôture dossier</p>
          <p id="ph-close-request-title" className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">
            Confirmer la clôture du dossier
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60 disabled:opacity-50"
          aria-label="Fermer"
          onClick={onClose}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 sm:px-4">
        <p className="text-[11px] leading-snug text-muted-foreground">
          Vérifiez l’état du dossier avant clôture définitive. Les lignes retenues non marquées « Récupéré » seront
          automatiquement retirées à la clôture.
        </p>
        <ul className="mt-3 space-y-1.5 text-[11px] leading-snug text-foreground">
          <li>
            <span className="font-semibold tabular-nums">{summary.totalLines}</span> ligne
            {summary.totalLines > 1 ? "s" : ""} au total
          </li>
          <li>
            <span className="font-semibold tabular-nums">{summary.retainedCount}</span> retenue
            {summary.retainedCount > 1 ? "s" : ""} à la validation
          </li>
          {summary.notRetainedAtValidation > 0 ? (
            <li>
              <span className="font-semibold tabular-nums">{summary.notRetainedAtValidation}</span> non retenue
              {summary.notRetainedAtValidation > 1 ? "s" : ""} à la validation initiale
            </li>
          ) : null}
          {summary.withdrawnAfterConfirm > 0 ? (
            <li>
              <span className="font-semibold tabular-nums">{summary.withdrawnAfterConfirm}</span> retirée
              {summary.withdrawnAfterConfirm > 1 ? "s" : ""} ou abandonnée après validation
            </li>
          ) : null}
          <li>
            <span className="font-semibold tabular-nums">{summary.pickedUpCount}</span> récupérée
            {summary.pickedUpCount > 1 ? "s" : ""} au comptoir
          </li>
          {summary.pendingPickupCount > 0 ? (
            <li className="text-amber-950">
              <span className="font-semibold tabular-nums">{summary.pendingPickupCount}</span> encore en attente de
              retrait
            </li>
          ) : null}
        </ul>
        {summary.hasPartialPickupWarning ? (
          <p className="mt-3 rounded-lg border border-amber-300/80 bg-amber-50/70 px-2.5 py-2 text-[10px] leading-snug text-amber-950">
            {summary.pickedUpCount} produit{summary.pickedUpCount > 1 ? "s" : ""} récupéré — {summary.pendingPickupCount} autre
            {summary.pendingPickupCount > 1 ? "s" : ""} sera
            {summary.pendingPickupCount > 1 ? "ont" : ""} retiré{summary.pendingPickupCount > 1 ? "s" : ""} automatiquement
            à la clôture.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:justify-end sm:px-4">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className={uiActionBtnModalOutline("h-10 text-xs font-semibold disabled:opacity-50")}
        >
          Retour
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={uiActionBtnModalPrimary("h-10 text-xs font-bold disabled:opacity-50")}
        >
          {busy ? "Clôture…" : "Confirmer la clôture"}
        </button>
      </div>
    </div>
  );
}
