"use client";

import { useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import type { PharmacistDeclareTreatedSummaryFr } from "@/lib/pharmacist-declare-treated-fr";

type Props = {
  open: boolean;
  busy: boolean;
  summary: PharmacistDeclareTreatedSummaryFr;
  onClose: () => void;
  onConfirm: () => void;
};

const noOpSubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(noOpSubscribe, () => true, () => false);
}

function ProductList({ title, lines }: { title: string; lines: { name: string; qty: number }[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/80 bg-muted/15 px-2.5 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1.5 space-y-1 text-[11px] leading-snug text-foreground">
        {lines.map((l) => (
          <li key={`${title}-${l.name}`} className="flex justify-between gap-2">
            <span className="min-w-0 flex-1">{l.name}</span>
            <span className="shrink-0 font-semibold tabular-nums">×{l.qty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PharmacistDeclareTreatedConfirmModal({ open, busy, summary, onClose, onConfirm }: Props) {
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

  const total =
    summary.reservedLines.length + summary.orderedLines.length + summary.otherLines.length;

  return (
    <AppModalOverlay
      open={open}
      aria-labelledby="ph-declare-treated-title"
      onBackdropClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Préparation officine</p>
            <p id="ph-declare-treated-title" className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">
              Déclarer la demande traitée
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
            Vous allez déclarer cette demande comme <strong className="font-semibold text-foreground">traitée</strong>.
            Cela signifie que vous confirmez avoir préparé la commande pour le patient :
          </p>
          {total === 0 ? (
            <p className="mt-3 rounded-lg border border-amber-300/80 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
              Aucune ligne retenue active. Vérifiez le dossier avant de continuer.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <ProductList
                title="Réservés ou mis de côté pour le patient"
                lines={summary.reservedLines}
              />
              <ProductList title="Commandés auprès du fournisseur" lines={summary.orderedLines} />
              {summary.otherLines.length > 0 ? (
                <ProductList title="Autres lignes retenues" lines={summary.otherLines} />
              ) : null}
            </div>
          )}
          <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
            Le patient pourra suivre le passage au comptoir. Vous pourrez ensuite marquer les réceptions en officine et
            les retraits au comptoir ligne par ligne.
          </p>
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
            disabled={busy || total === 0}
            onClick={onConfirm}
            className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50 sm:w-auto"
          >
            {busy ? "En cours…" : "Confirmer — demande traitée"}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
