"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CheckCircle2, Package, Truck, X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import type { PharmacistDeclareTreatedSummaryFr } from "@/lib/pharmacist-declare-treated-fr";
import { uiActionBtnModalOutline, uiActionBtnModalPrimary } from "@/lib/ui-action-buttons";
import { clsx } from "clsx";

type Props = {
  open: boolean;
  busy: boolean;
  summary: PharmacistDeclareTreatedSummaryFr;
  requestStatus?: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

const noOpSubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(noOpSubscribe, () => true, () => false);
}

function ProductList({
  title,
  lines,
  icon: Icon,
  accentClass,
}: {
  title: string;
  lines: { name: string; qty: number; statusNote?: string | null }[];
  icon: typeof Package;
  accentClass: string;
}) {
  if (lines.length === 0) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-card px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={clsx("inline-flex size-7 shrink-0 items-center justify-center rounded-lg", accentClass)}>
          <Icon className="size-3.5" strokeWidth={2.25} aria-hidden />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">{title}</p>
        <span className="ml-auto rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-bold tabular-nums text-foreground">
          {lines.length}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5 text-[11px] leading-snug text-foreground">
        {lines.map((l) => (
          <li key={`${title}-${l.name}`} className="flex items-start justify-between gap-2 rounded-md bg-muted/15 px-2 py-1.5">
            <div className="min-w-0 flex-1">
              <span className="line-clamp-2 font-medium">{l.name}</span>
              {l.statusNote ? (
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{l.statusNote}</span>
              ) : null}
            </div>
            <span className="shrink-0 font-bold tabular-nums">×{l.qty}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PharmacistDeclareTreatedConfirmModal({
  open,
  busy,
  summary,
  requestStatus = "confirmed",
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

  const total =
    summary.reservedLines.length + summary.orderedLines.length + summary.otherLines.length;
  const isAlreadyTreated = requestStatus === "treated";

  return (
    <AppModalOverlay
      open={open}
      aria-labelledby="ph-declare-treated-title"
      onBackdropClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-teal-200/70 bg-card shadow-2xl ring-1 ring-teal-100/80 sm:rounded-2xl">
        <div className="flex shrink-0 items-start gap-3 border-b border-border/80 bg-gradient-to-r from-teal-50/80 via-white to-sky-50/50 px-3 py-3 sm:px-4">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal-200/80 bg-teal-100/60 text-teal-800 shadow-sm">
            <CheckCircle2 className="size-5" strokeWidth={2.25} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-teal-800/90">Préparation officine</p>
            <p id="ph-declare-treated-title" className="mt-0.5 text-base font-bold leading-snug text-foreground">
              Déclarer la demande traitée
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Le patient sera notifié que sa commande est prête pour le passage en officine.
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
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
          {total === 0 ? (
            <p className="rounded-xl border border-amber-300/80 bg-amber-50/70 px-3 py-3 text-[12px] leading-snug text-amber-950">
              Aucune ligne retenue active à préparer. Vérifiez le dossier avant de continuer.
            </p>
          ) : (
            <div className="space-y-2.5">
              <ProductList
                title="Réservés ou mis de côté"
                lines={summary.reservedLines}
                icon={Package}
                accentClass="bg-sky-100/80 text-sky-800"
              />
              <ProductList
                title="Commandés fournisseur"
                lines={summary.orderedLines}
                icon={Truck}
                accentClass="bg-teal-100/80 text-teal-900"
              />
              {summary.otherLines.length > 0 ? (
                <ProductList
                  title="Autres lignes retenues"
                  lines={summary.otherLines}
                  icon={Package}
                  accentClass="bg-amber-100/80 text-amber-900"
                />
              ) : null}
            </div>
          )}
          <p className="mt-3 rounded-lg border border-border/70 bg-muted/15 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
            {isAlreadyTreated
              ? "Cette action confirme que la préparation est finalisée. Vous pourrez continuer à marquer les réceptions et retraits ligne par ligne."
              : "Après confirmation, le dossier passera en « Traitée ». Vous pourrez ensuite marquer les réceptions en officine et les retraits au comptoir sur chaque produit."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-muted/10 px-3 py-3 sm:flex-row sm:justify-end sm:px-4">
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
            disabled={busy || total === 0}
            onClick={onConfirm}
            className={uiActionBtnModalPrimary(
              "h-10 bg-teal-700 text-xs font-bold hover:bg-teal-800 disabled:opacity-50"
            )}
          >
            {busy ? "En cours…" : "Confirmer — demande traitée"}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
