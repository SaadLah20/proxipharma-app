"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { promoPublicTheme as pt } from "@/lib/promo/promo-public-theme";
import { supabase } from "@/lib/supabase";
import { uiActionBtnModalOutline, uiActionBtnModalPrimary } from "@/lib/ui-action-buttons";
import { cn } from "@/lib/utils";

const OFFERS_HUB_PATH = "/dashboard/pharmacien/offres-promos";

export function PharmacistPromoDeclineFollowUpModal({
  open,
  offerId,
  offerTitle,
  busy: parentBusy = false,
  onClose,
  onUnpublished,
}: {
  open: boolean;
  offerId: string;
  offerTitle: string;
  busy?: boolean;
  onClose: () => void;
  onUnpublished?: () => void;
}) {
  const [unpublishBusy, setUnpublishBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !unpublishBusy && !parentBusy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, parentBusy, unpublishBusy]);

  if (!open) return null;

  const busy = parentBusy || unpublishBusy;

  const unpublish = async () => {
    setError("");
    setUnpublishBusy(true);
    const { error: updateErr } = await supabase
      .from("pharmacy_promo_offers")
      .update({ status: "draft" })
      .eq("id", offerId);
    setUnpublishBusy(false);
    if (updateErr) {
      setError(updateErr.message);
      return;
    }
    onUnpublished?.();
    onClose();
  };

  return (
    <AppModalOverlay
      open={open}
      aria-labelledby="promo-decline-followup-title"
      onBackdropClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pack indisponible</p>
            <h2 id="promo-decline-followup-title" className="mt-0.5 text-sm font-bold leading-snug text-foreground">
              Mettre à jour l&apos;offre sur votre fiche ?
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted disabled:opacity-50"
            aria-label="Fermer"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Le patient a été informé que ce pack n&apos;est pas disponible. Vous pouvez le retirer de la fiche
            publique ou le modifier dans vos offres.
          </p>
          <p className={cn("rounded-lg border px-2.5 py-2 text-xs font-semibold leading-snug", pt.descriptionInset)}>
            {offerTitle}
          </p>
          {error ? <p className="rounded-lg bg-rose-50 px-2.5 py-2 text-xs text-rose-900">{error}</p> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:flex-wrap sm:justify-end">
          <button type="button" disabled={busy} onClick={onClose} className={uiActionBtnModalOutline()}>
            Rester sur la réservation
          </button>
          <Link
            href={OFFERS_HUB_PATH}
            onClick={() => {
              if (!busy) onClose();
            }}
            className={cn(uiActionBtnModalOutline(), "inline-flex items-center justify-center text-center")}
          >
            Offres et promos
          </Link>
          <button type="button" disabled={busy} onClick={() => void unpublish()} className={uiActionBtnModalPrimary()}>
            {unpublishBusy ? "Retrait…" : "Dépublier le pack"}
          </button>
        </div>
      </div>
    </AppModalOverlay>
  );
}
