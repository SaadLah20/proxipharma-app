"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Search, X } from "lucide-react";
import { clsx } from "clsx";
import { pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
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
  "inline-flex shrink-0 items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition";

export function ProductCatalogExplorerFilters({
  filters,
  onChange,
  brands,
  brandsLoading,
  fieldFocus,
  className,
}: {
  filters: ProductCatalogExplorerFilters;
  onChange: (next: ProductCatalogExplorerFilters) => void;
  brands: DistinctBrandRow[];
  brandsLoading: boolean;
  fieldFocus: string;
  className?: string;
}) {
  const td = useTranslations("demandePublic");
  const [brandPanelOpen, setBrandPanelOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");

  const showBrandFilter = brandFilterApplicable(filters.productType);

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands.slice(0, 80);
    return brands.filter((b) => b.brand_display.toLowerCase().includes(q)).slice(0, 80);
  }, [brands, brandSearch]);

  const setProductType = (productType: ProductCatalogTypeFilter) => {
    onChange({
      productType,
      brand: productType === "medicament" ? null : filters.brand,
    });
    if (productType === "medicament") {
      setBrandPanelOpen(false);
      setBrandSearch("");
    }
  };

  const selectBrand = (brandDisplay: string) => {
    onChange({ ...filters, brand: brandDisplay });
    setBrandPanelOpen(false);
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

  return (
    <div className={cn(pharmacyPublicCard, "overflow-hidden p-0", t.shell, className)}>
      <div className="border-b border-border/60 px-3 py-2.5 sm:px-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          {td("catalogFilterTypeLabel")}
        </p>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 scrollbar-none">
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
      </div>

      {showBrandFilter ? (
        <div className="border-b border-border/60 px-3 py-2.5 sm:px-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {td("catalogFilterBrandLabel")}
            </p>
            {filters.brand ? (
              <button
                type="button"
                onClick={clearBrand}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-800 hover:text-sky-950"
              >
                <X className="size-3" aria-hidden />
                {td("catalogFilterClearBrand")}
              </button>
            ) : null}
          </div>

          {filters.brand ? (
            <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-50/95 to-orange-50/50 px-2.5 py-1 text-xs font-semibold text-amber-950">
              <span className="truncate" title={filters.brand}>
                {filters.brand}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setBrandPanelOpen((o) => !o)}
              className={cn(
                "mt-2 flex h-10 w-full items-center justify-between gap-2 rounded-xl border-2 border-border/80 bg-background px-3 text-sm text-muted-foreground shadow-sm transition hover:border-sky-300/60 hover:bg-sky-50/40",
                fieldFocus
              )}
              aria-expanded={brandPanelOpen}
            >
              <span className="truncate text-left">{td("catalogFilterBrandPlaceholder")}</span>
              <ChevronDown
                className={cn("size-4 shrink-0 transition", brandPanelOpen && "rotate-180")}
                aria-hidden
              />
            </button>
          )}

          {brandPanelOpen && !filters.brand ? (
            <div className="mt-2 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
              <div className="relative border-b border-border/60 px-2 py-2">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <input
                  type="search"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder={td("catalogFilterBrandSearch")}
                  aria-label={td("catalogFilterBrandSearch")}
                  className={cn(
                    "h-9 w-full rounded-lg border border-border/70 bg-background py-1.5 pl-8 pr-2 text-sm placeholder:text-muted-foreground",
                    fieldFocus
                  )}
                />
              </div>
              <ul className="max-h-44 overflow-y-auto overscroll-y-contain py-1">
                {brandsLoading ? (
                  <li className="px-3 py-3 text-center text-xs text-muted-foreground">{td("catalogBrandsLoading")}</li>
                ) : filteredBrands.length === 0 ? (
                  <li className="px-3 py-3 text-center text-xs text-muted-foreground">{td("catalogNoBrandMatch")}</li>
                ) : (
                  filteredBrands.map((b) => (
                    <li key={b.brand_key}>
                      <button
                        type="button"
                        onClick={() => selectBrand(b.brand_display)}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40"
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
              {!brandsLoading && brands.length > 80 && !brandSearch.trim() ? (
                <p className="border-t border-border/60 px-3 py-1.5 text-[10px] text-muted-foreground">
                  {td("catalogBrandSearchHint")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
