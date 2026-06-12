"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronDown, Search, X } from "lucide-react";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { useCatalogDistinctBrands } from "@/lib/use-catalog-distinct-brands";
import { normalizeBrandKey } from "@/lib/pharmacy-pricing/normalize";

type PharmacyCatalogBrandFieldProps = {
  value: string;
  onChange: (brand: string) => void;
  enabled?: boolean;
};

export function PharmacyCatalogBrandField({
  value,
  onChange,
  enabled = true,
}: PharmacyCatalogBrandFieldProps) {
  const { brands, loading } = useCatalogDistinctBrands(enabled);
  const [modalOpen, setModalOpen] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [customMode, setCustomMode] = useState(false);

  const knownBrand = useMemo(() => {
    const key = normalizeBrandKey(value);
    if (!key) return null;
    return brands.find((b) => b.brand_key === key) ?? null;
  }, [value, brands]);

  const showCustomInput = customMode || Boolean(value.trim() && !knownBrand && !loading);

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands.slice(0, 100);
    return brands.filter((b) => b.brand_display.toLowerCase().includes(q)).slice(0, 100);
  }, [brands, brandSearch]);

  const openModal = () => {
    setBrandSearch("");
    setModalOpen(true);
  };

  const selectBrand = (display: string) => {
    setCustomMode(false);
    onChange(display);
    setModalOpen(false);
  };

  const switchToCustom = () => {
    setCustomMode(true);
    setModalOpen(false);
  };

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">Marque</span>

      {!showCustomInput ? (
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={openModal}
            className={clsx(
              "flex h-9 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 text-sm",
              value.trim() ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span className="truncate">{value.trim() || "Choisir une marque…"}</span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
          </button>
          {value.trim() ? (
            <button
              type="button"
              className="shrink-0 rounded-md border border-border px-2 text-[10px] font-semibold text-muted-foreground"
              onClick={() => onChange("")}
              aria-label="Effacer la marque"
            >
              Effacer
            </button>
          ) : null}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Saisir une nouvelle marque"
          className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
        />
      )}

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {!showCustomInput ? (
          <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={switchToCustom}>
            Autre marque (saisie libre)
          </button>
        ) : (
          <button
            type="button"
            className="font-semibold text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setCustomMode(false);
              if (!knownBrand) onChange("");
            }}
          >
            Choisir dans la liste
          </button>
        )}
      </div>

      {showCustomInput && value.trim() && !knownBrand && !loading ? (
        <p className="text-[10px] leading-snug text-amber-800">
          Marque hors catalogue — la marge globale de l&apos;officine s&apos;appliquera (sauf règle marque identique dans
          Pricing).
        </p>
      ) : null}

      {knownBrand && !showCustomInput ? (
        <p className="text-[10px] leading-snug text-emerald-800">
          Marge marque « {knownBrand.brand_display} » appliquée si configurée dans Pricing.
        </p>
      ) : null}

      <AppModalOverlay
        open={modalOpen}
        aria-labelledby="pharmacy-catalog-brand-modal-title"
        onBackdropClick={() => setModalOpen(false)}
        className="items-end p-0 sm:items-center sm:p-4"
      >
        <div
          className="flex max-h-[min(70dvh,480px)] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:max-w-md sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/80 px-3 py-2.5">
            <h2 id="pharmacy-catalog-brand-modal-title" className="text-sm font-bold text-foreground">
              Choisir une marque
            </h2>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
              aria-label="Fermer"
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
              placeholder="Rechercher une marque…"
              autoFocus
              className="h-9 w-full rounded-lg border border-border/70 bg-background py-1.5 ps-8 pe-2 text-sm"
            />
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-1">
            {loading ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Chargement…</li>
            ) : filteredBrands.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Aucune marque trouvée.</li>
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

          <div className="shrink-0 border-t border-border/60 p-2">
            <button
              type="button"
              onClick={switchToCustom}
              className="w-full rounded-lg border border-dashed border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
            >
              Autre marque (saisie libre)
            </button>
          </div>

          {!loading && brands.length > 100 && !brandSearch.trim() ? (
            <p className="shrink-0 border-t border-border/60 px-3 py-2 text-center text-[10px] text-muted-foreground">
              Affinez avec la recherche ({brands.length} marques).
            </p>
          ) : null}
        </div>
      </AppModalOverlay>
    </div>
  );
}
