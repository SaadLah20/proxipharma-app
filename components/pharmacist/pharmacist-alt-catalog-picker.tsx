"use client";

import { Package, Search } from "lucide-react";
import { CatalogProductAddButton } from "@/components/catalog/pharmacy-catalog-product-form-modal";
import { PharmacistProductPhotoThumb } from "@/components/pharmacist/pharmacist-product-photo-thumb";
import { ProductCatalogMetaLabel } from "@/components/products/product-brand-label";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing";
import { formatPharmacyCatalogPrice } from "@/lib/product-price";
import { catalogHitToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import type { UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";
import { unifiedCatalogHitKey } from "@/lib/pharmacy-catalog-request-insert";

export type AltCatalogHit = UnifiedCatalogHit;

/** Recherche catalogue pour ajouter une alternative (onglet dédié). */
export function PharmacistAltCatalogPicker({
  query,
  onQueryChange,
  hits,
  debouncedLen,
  busy,
  onSelect,
  onClose,
  pricingConfig,
  onPhotoPreview,
  onAddCustomProduct,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  hits: AltCatalogHit[];
  debouncedLen: number;
  busy: boolean;
  onSelect: (hit: AltCatalogHit) => void;
  onClose: () => void;
  pricingConfig: PharmacyPricingConfig | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
  onAddCustomProduct?: () => void;
}) {
  return (
    <div className="mx-2 mb-2 flex max-h-[min(70svh,28rem)] min-h-0 flex-col gap-2 overflow-hidden overscroll-y-contain rounded-xl border-2 border-teal-400/55 bg-white p-2.5 shadow-md ring-2 ring-teal-200/35">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-950">
          <Search className="size-3.5 shrink-0 text-teal-600" aria-hidden />
          Choisir un produit alternatif
        </span>
        <button
          type="button"
          className="rounded-md px-2 py-0.5 text-[10px] font-medium text-teal-800 hover:bg-teal-100/70"
          onClick={onClose}
        >
          Annuler
        </button>
      </div>
      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-teal-600/90"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Rechercher (2 caractères min.)"
          autoFocus
          className="h-10 w-full rounded-xl border-2 border-teal-400/50 bg-background py-2 pl-10 pr-3 text-[13px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35"
        />
      </div>
      {hits.length > 0 ? (
        <ul className="min-h-0 flex-1 touch-pan-y space-y-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card p-1 shadow-inner ring-1 ring-teal-200/35 [-webkit-overflow-scrolling:touch]">
          {hits.map((h) => (
            <li key={unifiedCatalogHitKey(h)}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSelect(h)}
                className="flex w-full touch-manipulation items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition hover:bg-muted/65 active:bg-muted/80 disabled:opacity-50"
              >
                <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-teal-200/60 bg-teal-50/50">
                  <PharmacistProductPhotoThumb
                    photoUrl={h.photo_url}
                    title={h.name}
                    brand={h.brand}
                    productType={h.product_type}
                    descriptionHtml={h.full_description}
                    onPhotoPreview={onPhotoPreview}
                    catalogExplorerPreview
                    iconClassName="text-teal-600/70"
                  />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight text-foreground">{h.name}</span>
                  <ProductCatalogMetaLabel productType={h.product_type} brand={h.brand} />
                  {h.source === "pharmacy" ? (
                    <span className="mt-0.5 block text-[10px] font-medium text-teal-800">Mon catalogue</span>
                  ) : null}
                  {formatPharmacyCatalogPrice(pricingConfig, catalogHitToPricingInput(h)) !== "—" ? (
                    <span className="mt-0.5 block text-[10px] font-semibold text-primary">
                      PU {formatPharmacyCatalogPrice(pricingConfig, catalogHitToPricingInput(h))}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : debouncedLen >= 2 ? (
        <p className="text-[10px] text-teal-800/80">Aucun résultat.</p>
      ) : (
        <p className="text-[10px] text-muted-foreground">Tapez au moins 2 lettres pour chercher dans le catalogue.</p>
      )}
      {onAddCustomProduct ? (
        <CatalogProductAddButton
          query={query}
          debouncedLen={debouncedLen}
          hitCount={hits.length}
          variant="teal"
          disabled={busy}
          onClick={onAddCustomProduct}
        />
      ) : null}
    </div>
  );
}
