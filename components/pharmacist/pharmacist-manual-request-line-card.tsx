"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, PackagePlus, Search } from "lucide-react";
import { clsx } from "clsx";
import { PharmacistAltCatalogPicker } from "@/components/pharmacist/pharmacist-alt-catalog-picker";
import {
  lineConversationVisual,
  PharmacistLineMessageButton,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { PharmacyCatalogProductFormModal } from "@/components/catalog/pharmacy-catalog-product-form-modal";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";
import { linkManualLineToProduct } from "@/lib/pharmacy-catalog-api";
import { searchPharmacyCatalog } from "@/lib/pharmacy-catalog-search";
import type { UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";
import { pharmacistProductRequestLineCardClass } from "@/lib/pharmacist-product-request-line-ui";
import {
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing";
import { supabase } from "@/lib/supabase";

export function PharmacistManualRequestLineCard({
  requestItemId,
  patientLabel,
  requestedQty,
  clientComment,
  pharmacyId,
  pricingConfig,
  canEdit,
  busy,
  pharmacistComment,
  convoOpen,
  onToggleConvo,
  onLinked,
  onPhotoPreview,
  onError,
}: {
  requestItemId: string;
  patientLabel: string;
  requestedQty: number;
  clientComment?: string | null;
  pharmacyId: string;
  pricingConfig: PharmacyPricingConfig | null;
  canEdit: boolean;
  busy: boolean;
  pharmacistComment?: string | null;
  convoOpen: boolean;
  onToggleConvo: () => void;
  onLinked: () => void | Promise<void>;
  onPhotoPreview?: ProductPhotoPreviewHandler;
  onError: (message: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<UnifiedCatalogHit[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const debounced = useMemo(() => query.trim(), [query]);
  const patientLineCc = clientComment?.trim() ?? "";
  const lineConvoVisual = lineConversationVisual(patientLineCc, pharmacistComment ?? "");

  useEffect(() => {
    if (!linkOpen || debounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS || !pharmacyId) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const run = async () => {
        const sanitized = sanitizeProductSearchQuery(debounced);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setHits([]);
          return;
        }
        setSearchBusy(true);
        try {
          const data = await searchPharmacyCatalog(supabase, pharmacyId, sanitized);
          setHits(data);
        } catch (e) {
          onError(e instanceof Error ? e.message : "Recherche impossible.");
          setHits([]);
        } finally {
          setSearchBusy(false);
        }
      };
      void run();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [debounced, linkOpen, pharmacyId, onError]);

  const handleLink = async (hit: UnifiedCatalogHit) => {
    setLinkBusy(true);
    onError("");
    try {
      await linkManualLineToProduct(supabase, requestItemId, hit);
      setLinkOpen(false);
      setQuery("");
      setHits([]);
      await onLinked();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Liaison impossible.");
    } finally {
      setLinkBusy(false);
    }
  };

  const handleCreated = async (hit: UnifiedCatalogHit) => {
    await handleLink(hit);
  };

  return (
    <>
      <div
        className={clsx(
          pharmacistProductRequestLineCardClass,
          "border-amber-300/60 bg-gradient-to-br from-amber-50/50 via-card to-card ring-amber-200/40"
        )}
      >
        <div className="flex items-start gap-2.5">
          <div className="flex size-[3.65rem] shrink-0 items-center justify-center rounded-md border border-amber-200/70 bg-amber-50/80 sm:size-[3.85rem]">
            <Package className="size-7 text-amber-600/80 sm:size-8" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                  {patientLabel}
                </p>
                <span className="inline-flex w-fit max-w-full rounded-full border border-amber-300/70 bg-amber-50/60 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-amber-950">
                  Saisi par le patient
                </span>
              </div>
              <PharmacistLineMessageButton
                visual={lineConvoVisual}
                open={convoOpen}
                disabled={busy || linkBusy}
                appearance="neutral"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleConvo();
                }}
              />
            </div>
            <p className="text-[10px] leading-snug text-muted-foreground">
              Associez ou créez un produit catalogue avant de répondre sur cette ligne.
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                <Package className="size-3 text-muted-foreground/80" aria-hidden />
                <span>
                  Demandé <strong className="text-foreground">{requestedQty}</strong>
                </span>
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">PU —</span>
            </div>
            {patientLineCc ? (
              <p className="line-clamp-2 text-[10px] leading-snug text-slate-700">
                <span className="font-semibold text-slate-800">Note patient · </span>
                {patientLineCc}
              </p>
            ) : null}
          </div>
        </div>

        {canEdit ? (
          <div className="mt-2.5 space-y-2 border-t border-amber-200/50 pt-2.5">
            {!linkOpen ? (
              <div className="flex flex-col gap-1.5 sm:flex-row">
                <button
                  type="button"
                  disabled={busy || linkBusy}
                  onClick={() => {
                    onError("");
                    setLinkOpen(true);
                    setQuery(patientLabel);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sky-300/70 bg-sky-50/80 px-3 py-2 text-[11px] font-semibold text-sky-950 transition hover:bg-sky-100/90 disabled:opacity-50"
                >
                  <Search className="size-3.5 shrink-0" aria-hidden />
                  Associer au catalogue
                </button>
                <button
                  type="button"
                  disabled={busy || linkBusy}
                  onClick={() => {
                    onError("");
                    setCreateOpen(true);
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-300/70 bg-teal-50/80 px-3 py-2 text-[11px] font-semibold text-teal-950 transition hover:bg-teal-100/90 disabled:opacity-50"
                >
                  <PackagePlus className="size-3.5 shrink-0" aria-hidden />
                  Créer dans mon catalogue
                </button>
              </div>
            ) : (
              <PharmacistAltCatalogPicker
                query={query}
                onQueryChange={setQuery}
                hits={hits}
                debouncedLen={debounced.length}
                busy={busy || linkBusy || searchBusy}
                onSelect={(h) => void handleLink(h)}
                onClose={() => {
                  setLinkOpen(false);
                  setQuery("");
                  setHits([]);
                }}
                pricingConfig={pricingConfig}
                onPhotoPreview={onPhotoPreview}
                onAddCustomProduct={() => setCreateOpen(true)}
              />
            )}
          </div>
        ) : null}
      </div>

      <PharmacyCatalogProductFormModal
        open={createOpen}
        prefillName={patientLabel}
        onClose={() => setCreateOpen(false)}
        onCreated={(hit) => void handleCreated(hit)}
      />
    </>
  );
}
