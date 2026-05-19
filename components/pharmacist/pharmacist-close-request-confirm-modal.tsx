"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  if (!open || !clientMounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-end justify-center pb-[env(safe-area-inset-bottom)] sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ph-close-request-title"
    >
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer" onClick={() => !busy && onClose()} />
      <CloseRequestDialogPanel busy={busy} summary={summary} onClose={onClose} onConfirm={onConfirm} />
    </div>,
    document.body
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
          Vérifiez l’état du dossier avant clôture définitive. Les lignes non récupérées au comptoir restent visibles dans
          l’historique.
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
              <span className="font-semibold tabular-nums">{summary.withdrawnAfterConfirm}</span> écartée
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
            Certaines lignes retenues ne sont pas marquées « Récupéré ». Vous pouvez clôturer si le client n’a plus besoin
            de ces produits — sinon marquez-les récupérées ou écartez-les avant de clôturer.
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:justify-end sm:px-4">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50 sm:w-auto"
        >
          Retour
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-foreground px-4 text-xs font-bold text-background shadow-sm transition hover:opacity-90 disabled:opacity-50 sm:w-auto"
        >
          {busy ? "Clôture…" : "Confirmer la clôture"}
        </button>
      </div>
    </div>
  );
}
