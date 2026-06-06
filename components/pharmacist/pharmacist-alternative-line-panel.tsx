"use client";

import { clsx } from "clsx";
import { Package, Trash2 } from "lucide-react";
import {
  ProductRequestLineQtyPicker,
  ProductRequestLineQtyReadonly,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { PharmacistProductPhotoThumb } from "@/components/pharmacist/pharmacist-product-photo-thumb";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing";
import { formatPharmacyCatalogPrice } from "@/lib/product-price";
import { productEmbedToPricingInput } from "@/lib/pharmacy-pricing/product-embed";

type AltProduct = {
  name?: string | null;
  photo_url?: string | null;
  full_description?: string | null;
  product_type?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  brand?: string | null;
  laboratory?: string | null;
};

export type PharmacistAltLineRow = {
  id: string;
  rank: number;
  product_id: string;
  available_qty?: number | null;
  products?: AltProduct | AltProduct[] | null;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** Bloc produit compact pour un onglet alternative (sous la barre d’onglets). */
export function PharmacistAlternativeLinePanel({
  alt,
  qtyValue,
  qtyBusy,
  onQtyChange,
  onQtyNudge,
  onRemove,
  removeBusy,
  pricingConfig,
  patientChoseThis,
  showIndicatif,
  useQtyPicker = false,
  readOnly = false,
  onPhotoPreview,
}: {
  alt: PharmacistAltLineRow;
  qtyValue: string;
  qtyBusy: boolean;
  onQtyChange: (raw: string) => void;
  onQtyNudge: (delta: -1 | 1) => void;
  onRemove: () => void;
  removeBusy: boolean;
  pricingConfig: PharmacyPricingConfig | null;
  patientChoseThis?: boolean;
  showIndicatif?: boolean;
  /** Liste 1–10 (parcours demande produits envoyée). */
  useQtyPicker?: boolean;
  /** Réponse publiée : consultation sans retrait ni changement de qté. */
  readOnly?: boolean;
  onPhotoPreview?: ProductPhotoPreviewHandler;
}) {
  const altProd = one(alt.products);
  const altName = altProd?.name ?? "Alternative";
  const photo = altProd?.photo_url?.trim() ? resolvePublicMediaUrl(altProd.photo_url) ?? altProd.photo_url : null;
  const catalogPu = formatPharmacyCatalogPrice(
    pricingConfig,
    productEmbedToPricingInput(
      altProd
        ? {
            product_type: altProd.product_type ?? "parapharmacie",
            price_pph: altProd.price_pph,
            price_ppv: altProd.price_ppv,
            brand: altProd.brand,
          }
        : null,
      alt.product_id
    )
  );

  return (
    <div
      className={clsx(
        "border-t border-teal-200/40 px-2 py-2 sm:px-2.5",
        patientChoseThis
          ? "bg-emerald-50/40"
          : showIndicatif
            ? "bg-white/60 opacity-90"
            : "bg-teal-50/20"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-teal-200/70 bg-white shadow-inner">
          <PharmacistProductPhotoThumb
            photoUrl={photo}
            title={altName}
            brand={altProd?.brand}
            productType={altProd?.product_type}
            descriptionHtml={altProd?.full_description}
            onPhotoPreview={onPhotoPreview}
            iconClassName="text-teal-600/70 size-6"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-snug text-teal-950" title={altName}>
                {altName}
              </p>
              <p className="mt-0.5 text-[10px] text-teal-800/85">
                Alternative #{alt.rank}
                {catalogPu !== "—" ? <span className="text-teal-700"> · PU {catalogPu}</span> : null}
              </p>
              {patientChoseThis ? (
                <span className="mt-1 inline-flex rounded-full bg-emerald-700 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                  Retenu par le patient
                </span>
              ) : null}
            </div>
            {!readOnly ? (
              <button
                type="button"
                disabled={removeBusy}
                onClick={onRemove}
                title="Retirer cette alternative"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2 py-1.5 text-[9px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Retirer
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-medium text-muted-foreground">Qté proposée</span>
            {useQtyPicker ? (
              readOnly ? (
                <ProductRequestLineQtyReadonly
                  qty={Math.min(10, Math.max(1, Number.parseInt(qtyValue, 10) || 1))}
                  appearance="neutral"
                />
              ) : (
                <ProductRequestLineQtyPicker
                  qty={Math.min(10, Math.max(1, Number.parseInt(qtyValue, 10) || 1))}
                  disabled={qtyBusy}
                  maxQty={10}
                  appearance="neutral"
                  onSelect={(n) => onQtyChange(String(n))}
                />
              )
            ) : (
              <>
                <div className="inline-flex h-8 items-center overflow-hidden rounded-lg border border-teal-300/70 bg-white shadow-sm">
                  <button
                    type="button"
                    disabled={qtyBusy}
                    className="h-full w-7 border-r border-teal-200/80 text-xs font-bold text-teal-900 disabled:opacity-40"
                    aria-label="Diminuer"
                    onClick={() => onQtyNudge(-1)}
                  >
                    −
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={qtyBusy}
                    className="h-full w-10 border-0 bg-transparent px-0.5 text-center text-[12px] font-bold tabular-nums text-teal-950 focus:outline-none"
                    value={qtyValue}
                    onChange={(e) => onQtyChange(e.target.value.replace(/[^\d]/g, ""))}
                  />
                  <button
                    type="button"
                    disabled={qtyBusy}
                    className="h-full w-7 border-l border-teal-200/80 text-xs font-bold text-teal-900 disabled:opacity-40"
                    aria-label="Augmenter"
                    onClick={() => onQtyNudge(1)}
                  >
                    +
                  </button>
                </div>
                <span className="text-[8px] text-teal-800/75">max 10</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
