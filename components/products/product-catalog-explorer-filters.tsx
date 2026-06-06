"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, Tag, X } from "lucide-react";
import { clsx } from "clsx";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import type { DistinctBrandRow } from "@/lib/pharmacy-pricing/api";
import {
  PRODUCT_CATALOG_TYPE_FILTERS,
  brandFilterApplicable,
  type ProductCatalogExplorerFilters,
  type ProductCatalogTypeFilter,
} from "@/lib/product-catalog-filters";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { cn } from "@/lib/utils";

const TYPE_CHIP =
  "inline-flex shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold transition sm:px-3 sm:py-1.5 sm:text-xs";

type ToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchPlaceholder?: string;
  filters: ProductCatalogExplorerFilters;
  onChange: (next: ProductCatalogExplorerFilters) => void;
  brands: DistinctBrandRow[];
  brandsLoading: boolean;
  fieldFocus: string;
  className?: string;
};

/** Barre unique : recherche produit + filtres type / marque (marque en modale). */
export function ProductCatalogExplorerToolbar({
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  filters,
  onChange,
  brands,
  brandsLoading,
  fieldFocus,
  className,
}: ToolbarProps) {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  const showBrandFilter = brandFilterApplicable(filters.productType);
  const resolvedSearchPlaceholder = searchPlaceholder ?? td("catalogSearchPlaceholder");

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands.slice(0, 100);
    return brands.filter((b) => b.brand_display.toLowerCase().includes(q)).slice(0, 100);
  }, [brands, brandSearch]);

  const setProductType = (productType: ProductCatalogTypeFilter) => {
    onChange({
      productType,
      brand: productType === "medicament" ? null : filters.brand,
    });
    if (productType === "medicament") {
      setBrandModalOpen(false);
      setBrandSearch("");
    }
  };

  const selectBrand = (brandDisplay: string) => {
    onChange({ ...filters, brand: brandDisplay });
    setBrandModalOpen(false);
    setBrandSearch("");
  };

  const clearBrand = () => {
    onChange({ ...filters, brand: null });
    setBrandSearch("");
  };

  const typeLabel = (key: ProductCatalogTypeFilter) => {
    if (key === "all") return td("catalogFilterAll");
    if (key === "parapharmacie") return td("catalogFilterParapharmacy");
    return td("catalogFilterMedicament");
  };

  const closeBrandModal = () => {
    setBrandModalOpen(false);
    setBrandSearch("");
  };

  return (
    <>
      <div className={cn(pharmacyPublicCard, "overflow-hidden p-0 shadow-sm", t.shell, className)}>
        <div className="relative border-b border-border/50 px-2.5 py-2 sm:px-3">
          <Search
            className={cn(
              "pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 sm:start-3.5",
              t.searchIcon
            )}
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder={resolvedSearchPlaceholder}
            aria-label={resolvedSearchPlaceholder}
            className={cn(
              "h-10 w-full rounded-xl border border-border/80 bg-background py-2 ps-9 pe-2 text-sm leading-normal shadow-sm placeholder:text-muted-foreground",
              t.searchInput,
              fieldFocus
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 sm:px-3">
          <div className="-mx-0.5 flex min-w-0 flex-1 gap-1 overflow-x-auto scrollbar-none">
            {PRODUCT_CATALOG_TYPE_FILTERS.map((key) => {
              const active = filters.productType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProductType(key)}
                  className={clsx(
                    TYPE_CHIP,
                    active
                      ? "border-sky-400/90 bg-sky-600 text-white shadow-sm"
                      : "border-border/80 bg-card text-foreground hover:border-sky-300/70 hover:bg-sky-50/60"
                  )}
                  aria-pressed={active}
                >
                  {typeLabel(key)}
                </button>
              );
            })}
          </div>

          {showBrandFilter ? (
            <div className="flex shrink-0 items-center gap-1">
              {filters.brand ? (
                <span className="inline-flex max-w-[7.5rem] items-center gap-0.5 rounded-full border border-amber-200/90 bg-amber-50/90 py-0.5 ps-2 pe-0.5 text-[10px] font-semibold text-amber-950 sm:max-w-[9rem] sm:text-[11px]">
                  <span className="truncate" title={filters.brand}>
                    {filters.brand}
                  </span>
                  <button
                    type="button"
                    onClick={clearBrand}
                    className="flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-amber-100/80"
                    aria-label={td("catalogFilterClearBrand")}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setBrandModalOpen(true)}
                  className={cn(
                    TYPE_CHIP,
                    "gap-1 border-border/80 bg-card text-foreground hover:border-sky-300/70 hover:bg-sky-50/60"
                  )}
                >
                  <Tag className="size-3 shrink-0 opacity-70" aria-hidden />
                  {td("catalogFilterBrandLabel")}
                  <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <AppModalOverlay
        open={brandModalOpen}
        aria-labelledby="catalog-brand-modal-title"
        onBackdropClick={closeBrandModal}
        className="items-end p-0 sm:items-center sm:p-4"
      >
        <div
          className="flex max-h-[min(78dvh,520px)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5">
            <h2 id="catalog-brand-modal-title" className="text-sm font-bold text-foreground">
              {td("catalogFilterBrandPlaceholder")}
            </h2>
            <button
              type="button"
              onClick={closeBrandModal}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
              aria-label={tc("close")}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="relative shrink-0 border-b border-border/60 px-3 py-2">
            <Search
              className="pointer-events-none absolute start-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder={td("catalogFilterBrandSearch")}
              aria-label={td("catalogFilterBrandSearch")}
              autoFocus
              className={cn(
                "h-9 w-full rounded-lg border border-border/70 bg-background py-1.5 ps-8 pe-2 text-sm placeholder:text-muted-foreground",
                fieldFocus
              )}
            />
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-1 [-webkit-overflow-scrolling:touch]">
            {brandsLoading ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">{td("catalogBrandsLoading")}</li>
            ) : filteredBrands.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">{td("catalogNoBrandMatch")}</li>
            ) : (
              filteredBrands.map((b) => (
                <li key={b.brand_key}>
                  <button
                    type="button"
                    onClick={() => selectBrand(b.brand_display)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start text-sm hover:bg-muted/40"
                  >
                    <span className="min-w-0 truncate font-medium text-foreground">{b.brand_display}</span>
                    <span className="shrink-0 tabular-nums text-[10px] font-semibold text-muted-foreground">
                      {b.product_count}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          {!brandsLoading && brands.length > 100 && !brandSearch.trim() ? (
            <p className="shrink-0 border-t border-border/60 px-3 py-2 text-center text-[10px] text-muted-foreground">
              {td("catalogBrandSearchHint")}
            </p>
          ) : null}
        </div>
      </AppModalOverlay>
    </>
  );
}
