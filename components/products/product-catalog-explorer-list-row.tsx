"use client";

import { Check } from "lucide-react";
import { clsx } from "clsx";
import { ProductCatalogExplorerThumb } from "@/components/products/product-catalog-explorer-thumb";
import { ProductCatalogMetaLabel } from "@/components/products/product-brand-label";
import { PriceDhInline } from "@/components/pharmacy/patient-demande-produits-ui";
import type { PatientDemandeProduitsCatalogProduct } from "@/lib/patient-demande-produits-draft";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

const THUMB =
  "box-border size-[4.25rem] shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm";

export function ProductCatalogExplorerListRow({
  product,
  inCart,
  checked,
  unitPrice,
  onToggleSelect,
  onOpenPreview,
  labels,
}: {
  product: PatientDemandeProduitsCatalogProduct & { photo_url: string | null };
  inCart: boolean;
  checked: boolean;
  unitPrice: number | null;
  onToggleSelect: () => void;
  onOpenPreview: () => void;
  labels: {
    alreadyInRequest: string;
    selectAria: string;
    deselectAria: string;
    inCartAria: string;
  };
}) {
  return (
    <li className="px-2 py-1.5 sm:px-2.5">
      <div
        className={cn(
          "flex items-stretch gap-2.5 rounded-2xl border p-2 transition",
          inCart
            ? "border-border/60 bg-muted/20 opacity-85"
            : checked
              ? "border-sky-400/70 bg-gradient-to-br from-sky-50/90 via-card to-white shadow-sm ring-1 ring-sky-200/50"
              : "border-border/75 bg-card shadow-sm hover:border-sky-200/60 hover:bg-sky-50/25"
        )}
      >
        <button
          type="button"
          disabled={inCart}
          onClick={onToggleSelect}
          className={clsx(
            "flex size-9 shrink-0 self-center items-center justify-center rounded-xl border-2 transition",
            inCart
              ? "border-border/50 bg-muted/50"
              : checked
                ? "border-sky-600 bg-sky-600 text-white shadow-sm"
                : "border-border/80 bg-background hover:border-sky-400/70 hover:bg-sky-50/80"
          )}
          aria-label={
            inCart ? labels.inCartAria : checked ? labels.deselectAria : labels.selectAria
          }
          aria-pressed={inCart ? undefined : checked}
        >
          {inCart ? null : checked ? <Check className="size-4" strokeWidth={2.5} /> : null}
        </button>

        <ProductCatalogExplorerThumb
          photoUrl={product.photo_url}
          productType={product.product_type}
          productName={product.name}
          className={cn(THUMB, "self-center")}
          ringClassName={t.photoRing}
          onOpenPreview={onOpenPreview}
        />

        <button
          type="button"
          disabled={inCart}
          onClick={onToggleSelect}
          className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5 text-left disabled:cursor-not-allowed"
        >
          <p
            className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground"
            title={product.name}
          >
            {product.name}
          </p>
          <ProductCatalogMetaLabel productType={product.product_type} brand={product.brand} />
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className={cn("text-sm font-bold leading-none", t.price)}>
              <PriceDhInline
                value={unitPrice}
                amountClassName={cn("font-bold", t.price)}
                suffixClassName="text-[10px] font-semibold text-sky-700/70"
              />
            </p>
            {inCart ? (
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {labels.alreadyInRequest}
              </span>
            ) : null}
          </div>
        </button>
      </div>
    </li>
  );
}
