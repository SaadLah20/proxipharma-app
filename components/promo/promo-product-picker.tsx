"use client";

import { useMemo, useState, type UIEvent } from "react";
import { Loader2, Plus, Search } from "lucide-react";
import {
  CatalogProductPhotoThumb,
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import type { PromoCatalogProduct } from "@/lib/promo/catalog";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { usePromoProductSearch } from "@/lib/use-promo-product-search";
import { filterCatalogHitsExcludingProductIds } from "@/lib/product-catalog-search";

export function PromoProductPicker({
  disabled,
  onPick,
  excludeProductIds,
}: {
  disabled?: boolean;
  onPick: (p: PromoCatalogProduct) => void;
  excludeProductIds?: ReadonlySet<string>;
}) {
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const { products, loading, loadingMore, error, hasMore, loadMore, searchActive, minChars } = usePromoProductSearch(q);

  const hits = useMemo(
    () => filterCatalogHitsExcludingProductIds(products, excludeProductIds ?? new Set()),
    [products, excludeProductIds],
  );

  const handleResultsScroll = (event: UIEvent<HTMLUListElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight > 96) return;
    loadMore();
  };

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          autoComplete="off"
          className="h-9 w-full rounded-lg border bg-background pl-8 pr-2 text-xs"
          placeholder="Rechercher un produit (2 caractères min.)…"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {!searchActive && q.trim().length > 0 && q.trim().length < minChars ? (
        <p className="text-[10px] text-muted-foreground">Tapez au moins {minChars} caractères pour chercher dans tout le catalogue.</p>
      ) : null}

      {searchActive ? (
        loading ? (
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Recherche…
          </p>
        ) : error ? (
          <p className="text-[10px] text-destructive">{error}</p>
        ) : hits.length > 0 ? (
          <ul
            className="max-h-[min(50svh,16rem)] touch-pan-y space-y-1 overflow-y-auto overscroll-y-contain rounded-lg border bg-card p-1 [-webkit-overflow-scrolling:touch]"
            onScroll={handleResultsScroll}
          >
            {hits.map((p) => {
              const photo = resolvePublicMediaUrl(p.photo_url);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex w-full touch-manipulation items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50 active:bg-muted/70"
                    onClick={() => {
                      onPick(p);
                      setQ("");
                    }}
                  >
                    {photo ? (
                      <CatalogProductPhotoThumb
                        imageUrl={photo}
                        title={p.name}
                        descriptionHtml={productDescriptionHtmlForDisplay(p.full_description)}
                        size={32}
                        onPreview={setPreview}
                      />
                    ) : (
                      <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-[9px]">—</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-semibold leading-snug">{p.name}</span>
                      {p.price_pph != null ? (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{p.price_pph.toFixed(2)} DH</span>
                      ) : null}
                    </span>
                    <Plus className="size-3.5 shrink-0 text-primary" />
                  </button>
                </li>
              );
            })}
            {loadingMore ? (
              <li className="flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                Chargement…
              </li>
            ) : hasMore ? (
              <li className="py-1 text-center text-[10px] text-muted-foreground">Faites défiler pour voir plus</li>
            ) : null}
          </ul>
        ) : (
          <p className="text-[10px] text-muted-foreground">Aucun produit trouvé.</p>
        )
      ) : null}

      <PatientProductPhotoPreviewModal
        open={Boolean(preview)}
        imageUrl={preview?.url ?? null}
        title={preview?.title ?? ""}
        descriptionHtml={preview?.descriptionHtml}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}

export function PromoCompactLinesList({
  lines,
  onRemove,
  onQtyChange,
}: {
  lines: { key: string; label: string; sub?: string; qty: number; kind: "product" | "gift" }[];
  onRemove: (key: string) => void;
  onQtyChange: (key: string, qty: number) => void;
}) {
  if (lines.length === 0) return <p className="text-[11px] text-muted-foreground">Aucune ligne.</p>;
  return (
    <ul className="space-y-1">
      {lines.map((l) => (
        <li key={l.key} className="flex items-center gap-2 rounded-lg border bg-muted/15 px-2 py-1.5 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{l.label}</p>
            {l.sub ? <p className="text-[10px] text-muted-foreground">{l.sub}</p> : null}
          </div>
          {l.kind === "product" ? (
            <input
              type="number"
              min={1}
              max={99}
              className="h-8 w-12 rounded border px-1 text-center text-xs font-bold tabular-nums"
              value={l.qty}
              onChange={(e) => onQtyChange(l.key, Math.max(1, Number(e.target.value) || 1))}
            />
          ) : (
            <span className="text-[10px] text-muted-foreground">Cadeau</span>
          )}
          <button type="button" className="text-[10px] font-semibold text-destructive underline" onClick={() => onRemove(l.key)}>
            Retirer
          </button>
        </li>
      ))}
    </ul>
  );
}
