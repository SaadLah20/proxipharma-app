"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { clsx } from "clsx";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { X } from "lucide-react";
import { SUPPLY_AMEND_CHANNEL_OPTIONS, type SupplyAmendClientChannelSlug } from "@/lib/supply-amendment-channels";

export type SupplyConfirmBlock = {
  key: string;
  title: string;
  subtitle?: string;
};

export type SupplyModalFillRow = { channel: string; motive: string };

type ModalProps = {
  open: boolean;
  onClose: () => void;
  heading: string;
  intro?: string;
  blocks: SupplyConfirmBlock[];
  confirmLabel: string;
  busy: boolean;
  onConfirm: (fills: SupplyModalFillRow[]) => void;
};

const noOpSubscribe = () => () => {};

function useClientMounted() {
  return useSyncExternalStore(noOpSubscribe, () => true, () => false);
}

function PharmacistSupplyAmendmentConfirmModalInner({
  onClose,
  heading,
  intro,
  blocks,
  confirmLabel,
  busy,
  onConfirm,
}: Omit<ModalProps, "open">) {
  const [fills, setFills] = useState<SupplyModalFillRow[]>(() => blocks.map(() => ({ channel: "", motive: "" })));
  const clientMounted = useClientMounted();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const confirmDisabled =
    busy ||
    blocks.length === 0 ||
    fills.length !== blocks.length ||
    fills.some((row, i) => !row || !blocks[i] || !row.channel?.trim());

  const shell = (
    <AppModalOverlay open onBackdropClick={() => !busy && onClose()}>
      <div className="relative z-10 flex max-h-[min(92dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
        <div className="shrink-0 flex items-start justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Confirmation client</p>
            <p className="mt-0.5 text-[13px] font-semibold leading-snug text-foreground">{heading}</p>
            {intro ? <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{intro}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="shrink-0 rounded-lg p-1 text-foreground hover:bg-muted"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 touch-pan-y space-y-3 overflow-y-auto overscroll-contain px-3 py-3">
          {blocks.length === 0 ? (
            <p className="text-[12px] leading-snug text-muted-foreground">
              Aucun détail à confirmer. Fermez cette fenêtre et réessayez depuis le menu de la ligne.
            </p>
          ) : (
            blocks.map((b, i) => (
              <div key={b.key} className="rounded-xl border border-sky-200/80 bg-sky-50/40 p-2.5 shadow-sm">
                <p className="text-[11px] font-semibold leading-snug text-sky-950">{b.title}</p>
                {b.subtitle ? (
                  <p className="mt-0.5 text-[10px] leading-snug text-sky-900/85">{b.subtitle}</p>
                ) : null}
                <label className="mt-2 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  Canal utilisé
                  <select
                    className={clsx(
                      "mt-0.5 h-9 w-full rounded-lg border border-input bg-background px-2 text-[12px] font-medium shadow-sm",
                      fills[i]?.channel?.trim() ? "text-foreground" : "text-muted-foreground"
                    )}
                    disabled={busy}
                    value={fills[i]?.channel ?? ""}
                    onChange={(e) => {
                      const v = e.target.value as SupplyAmendClientChannelSlug | "";
                      setFills((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], channel: v };
                        return next;
                      });
                    }}
                  >
                    <option value="" disabled className="text-muted-foreground">
                      Choisir un canal…
                    </option>
                    {SUPPLY_AMEND_CHANNEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-2 block text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  Précision (optionnel)
                  <textarea
                    rows={2}
                    disabled={busy}
                    value={fills[i]?.motive ?? ""}
                    onChange={(e) => {
                      const t = e.target.value.slice(0, 500);
                      setFills((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], motive: t };
                        return next;
                      });
                    }}
                    placeholder="Ex. accord exprimé par le patient…"
                    className="mt-0.5 w-full resize-y rounded-lg border border-input bg-background px-2 py-1.5 text-[11px] shadow-sm placeholder:text-muted-foreground"
                  />
                </label>
              </div>
            ))
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-2 border-t border-border bg-muted/15 px-3 py-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 rounded-lg border border-border bg-background px-4 text-[12px] font-semibold text-foreground shadow-sm hover:bg-muted/50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={confirmDisabled}
            onClick={() => onConfirm(fills)}
            className="h-10 rounded-lg border border-sky-800 bg-sky-950 px-4 text-[12px] font-bold text-white shadow-sm hover:bg-sky-900 disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : confirmLabel}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );

  if (!clientMounted) return null;
  return shell;
}

export function PharmacistSupplyAmendmentConfirmModal({ open, blocks, ...rest }: ModalProps) {
  const blockSig = blocks.map((x) => x.key).join("|");
  if (!open) return null;
  return <PharmacistSupplyAmendmentConfirmModalInner key={blockSig} blocks={blocks} {...rest} />;
}
