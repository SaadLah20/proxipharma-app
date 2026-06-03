"use client";

import { PublicPromoOfferCard } from "@/components/promo/public-promo-offer-card";
import type { PromoOfferPreviewBundle } from "@/lib/promo/build-offer-preview-bundle";
import { PharmacyPublicSectionTitle } from "@/components/pharmacy/pharmacy-public-chrome";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";

export function PublicPromoOfferPreviewModal({
  open,
  bundle,
  pharmacyId,
  onClose,
}: {
  open: boolean;
  bundle: PromoOfferPreviewBundle | null;
  pharmacyId: string;
  onClose: () => void;
}) {
  if (!open || !bundle) return null;

  return (
    <AppModalOverlay open={open} onBackdropClick={onClose} aria-labelledby="promo-public-preview-title">
      <div
        className="mx-auto max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border/80 bg-slate-50/95 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="promo-public-preview-title" className="text-base font-bold text-foreground">
              Aperçu fiche publique
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Rendu patient — onglet Offres de votre fiche pharmacie
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/40"
            onClick={onClose}
          >
            Fermer
          </button>
        </div>

        <PharmacyPublicSectionTitle title="Offres promotionnelles" hint="1 pack affiché (aperçu)" />
        <PublicPromoOfferCard
          offer={bundle}
          pharmacyId={pharmacyId}
          previewMode
          expanded
          collapsible={false}
        />
      </div>
    </AppModalOverlay>
  );
}
