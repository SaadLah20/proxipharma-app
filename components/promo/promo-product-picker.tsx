"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  ClickablePromoProductPhoto,
  PromoProductPhotoLightbox,
  type PromoProductPhotoLightboxState,
} from "@/components/promo/promo-product-photo-lightbox";
import { filterPromoCatalogProducts, type PromoCatalogProduct } from "@/lib/promo/catalog";
import { resolvePublicMediaUrl } from "@/lib/storage-media";

export function PromoProductPicker({
  products,
  disabled,
  onPick,
}: {
  products: PromoCatalogProduct[];
  disabled?: boolean;
  onPick: (p: PromoCatalogProduct) => void;
}) {
  const [q, setQ] = useState("");
  const [lightbox, setLightbox] = useState<PromoProductPhotoLightboxState>(null);
  const hits = useMemo(() => filterPromoCatalogProducts(products, q), [products, q]);

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          className="h-9 w-full rounded-lg border bg-background pl-8 pr-2 text-xs"
          placeholder="Rechercher un produit…"
          value={q}
          disabled={disabled}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q.trim() && hits.length > 0 ? (
        <ul className="max-h-36 space-y-1 overflow-y-auto rounded-lg border bg-card p-1">
          {hits.map((p) => {
            const photo = resolvePublicMediaUrl(p.photo_url);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={disabled}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/50"
                  onClick={() => {
                    onPick(p);
                    setQ("");
                  }}
                >
                  {photo ? (
                    <ClickablePromoProductPhoto
                      url={photo}
                      label={p.name}
                      size={32}
                      onOpen={setLightbox}
                    />
                  ) : (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-[9px]">—</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 font-semibold">{p.name}</span>
                    {p.price_pph != null ? (
                      <span className="text-[10px] text-muted-foreground tabular-nums">{p.price_pph.toFixed(2)} DH</span>
                    ) : null}
                  </span>
                  <Plus className="size-3.5 shrink-0 text-primary" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : q.trim() ? (
        <p className="text-[10px] text-muted-foreground">Aucun produit trouvé.</p>
      ) : null}
      <PromoProductPhotoLightbox state={lightbox} onClose={() => setLightbox(null)} />
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
