"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  markPatientDemandeCatalogueReturnEdit,
  mergeCatalogProductsIntoDraft,
  readPatientDemandeProduitsDraft,
  type PatientDemandeProduitsCatalogProduct,
  writePatientDemandeProduitsDraft,
} from "@/lib/patient-demande-produits-draft";
import { PharmacyPublicBackLink, pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import {
  PriceDhInline,
  ProductRequestExplorerSearchBar,
  ProductRequestSection,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { Button } from "@/components/ui/button";
import {
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { cn } from "@/lib/utils";
import { PlatformStickyFooter } from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass } from "@/lib/platform-sticky-footer";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { uiActionBtnFull } from "@/lib/ui-action-buttons";
import { usePharmacyPricingForPatient } from "@/lib/pharmacy-pricing";
import { catalogHitToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import { ProductCatalogExplorerThumb } from "@/components/products/product-catalog-explorer-thumb";
import { ProductCatalogMetaLabel } from "@/components/products/product-brand-label";
import { useProductCatalogExplorer } from "@/lib/use-product-catalog-explorer";

const THUMB = "box-border size-14 shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

export default function DemandeProduitsCataloguePage() {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pharmacyId = typeof params.id === "string" ? params.id : "";
  const editRequestId = searchParams.get("requestId")?.trim() || undefined;
  const returnToParam = searchParams.get("returnTo")?.trim();

  const [sessionReady, setSessionReady] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedById, setSelectedById] = useState<Map<string, PatientDemandeProduitsCatalogProduct>>(
    () => new Map()
  );
  const [photoPreview, setPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const [adding, setAdding] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLLIElement>(null);
  const listScrollRef = useRef<HTMLUListElement>(null);
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);

  const { products, loading, loadingMore, error: loadError, hasMore, loadMore } = useProductCatalogExplorer(
    sessionReady,
    filterQuery
  );

  const fieldFocus = t.focus;

  const backHref =
    returnToParam && returnToParam.startsWith("/")
      ? returnToParam
      : editRequestId
        ? `/dashboard/demandes/${editRequestId}`
        : `/pharmacie/${pharmacyId}/demande-produits`;
  const backLabel = editRequestId ? td("backToDossier") : td("backToRequest");

  useEffect(() => {
    const gate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace(`/auth?redirect=/pharmacie/${pharmacyId}/demande-produits/catalogue`);
        return;
      }
      setSessionReady(true);
    };
    void gate();
  }, [router, pharmacyId]);

  const cartProductIds = useMemo(() => {
    if (!sessionReady || !pharmacyId) return new Set<string>();
    const draft = readPatientDemandeProduitsDraft(pharmacyId, editRequestId);
    return new Set(draft.map((l) => l.product_id));
  }, [sessionReady, pharmacyId, editRequestId]);

  const displayProducts = useMemo(
    () =>
      products.map((p) => ({
        ...p,
        photo_url: resolvePublicMediaUrl(p.photo_url),
      })),
    [products]
  );

  const filtered = useMemo(() => {
    if (cartProductIds.size === 0) return displayProducts;
    return displayProducts.filter((p) => !cartProductIds.has(p.id));
  }, [displayProducts, cartProductIds]);

  useEffect(() => {
    const root = listScrollRef.current;
    const sentinel = loadMoreSentinelRef.current;
    if (!root || !sentinel || loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, loadMore, filtered.length]);

  const toggleSelect = (product: PatientDemandeProduitsCatalogProduct) => {
    if (cartProductIds.has(product.id)) return;
    setSelectedById((prev) => {
      const next = new Map(prev);
      if (next.has(product.id)) next.delete(product.id);
      else next.set(product.id, product);
      return next;
    });
  };

  const selectedCount = selectedById.size;

  const addButtonLabel = (() => {
    if (adding) return td("adding");
    if (selectedCount === 0) return td("selectProductsFirst");
    const suffixKey = editRequestId ? "addCountToDossier" : "addCountToRequest";
    const suffixKeyPlural = editRequestId ? "addCountToDossierPlural" : "addCountToRequestPlural";
    return td(selectedCount > 1 ? suffixKeyPlural : suffixKey, { count: selectedCount });
  })();

  const addSelectedAndReturn = () => {
    if (!pharmacyId || selectedCount === 0) return;
    setAdding(true);
    const toAdd = Array.from(selectedById.values());
    const existing = readPatientDemandeProduitsDraft(pharmacyId, editRequestId);
    const merged = mergeCatalogProductsIntoDraft(
      existing,
      toAdd,
      resolvePublicMediaUrl,
      (p) => resolveCatalogPrice(catalogHitToPricingInput(p))
    );
    writePatientDemandeProduitsDraft(pharmacyId, merged, editRequestId);
    if (editRequestId) markPatientDemandeCatalogueReturnEdit(editRequestId);
    setAdding(false);
    router.push(backHref);
  };

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">{td("sessionCheck")}</p>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen touch-pan-y bg-background text-foreground antialiased",
        stickyFooterPadClass("standard")
      )}
    >
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <PharmacyPublicBackLink href={backHref} className={cn("mb-0", t.backLink)}>
          {backLabel}
        </PharmacyPublicBackLink>

        <ProductRequestSection
          title={td("explorerCatalogTitle")}
          hint={td("explorerCatalogHint")}
          badge={
            selectedCount > 0 ? (
              <span className={cn("shrink-0", t.sectionBadge)}>
                {td(selectedCount > 1 ? "selectedCheckedPlural" : "selectedChecked", { count: selectedCount })}
              </span>
            ) : null
          }
        >
          <ProductRequestExplorerSearchBar
            query={filterQuery}
            onQueryChange={setFilterQuery}
            fieldFocus={fieldFocus}
            placeholder={td("searchProduct")}
          />

          <div className={cn(pharmacyPublicCard, "mt-2 overflow-hidden p-0", t.shell)}>
            {loadError ? <p className="px-3 py-3 text-sm text-destructive">{loadError}</p> : null}
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{td("noProductsFound")}</p>
            ) : (
              <ul
                ref={listScrollRef}
                className="max-h-[min(58dvh,520px)] divide-y divide-border/60 overflow-y-auto overscroll-y-contain touch-pan-y"
              >
                {filtered.map((p) => {
                  const inCart = cartProductIds.has(p.id);
                  const checked = !inCart && selectedById.has(p.id);
                  const unitPrice = resolveCatalogPrice(catalogHitToPricingInput(p));
                  return (
                    <li key={p.id}>
                      <div
                        className={cn(
                          "flex min-h-14 items-stretch gap-2 px-3 py-2 transition",
                          inCart ? "bg-muted/25 opacity-80" : checked ? "bg-sky-50/40" : "hover:bg-muted/20"
                        )}
                      >
                        <button
                          type="button"
                          disabled={inCart}
                          onClick={() => toggleSelect(p)}
                          className={cn(
                            "flex size-9 shrink-0 self-center items-center justify-center rounded-lg border-2 transition",
                            inCart
                              ? "border-border/60 bg-muted"
                              : checked
                                ? "border-sky-600 bg-sky-600 text-white"
                                : "border-border/80 bg-card hover:border-sky-400/60"
                          )}
                          aria-label={
                            inCart
                              ? td("alreadyInRequestAria", { name: p.name })
                              : checked
                                ? td("deselectProductAria", { name: p.name })
                                : td("selectProductAria", { name: p.name })
                          }
                          aria-pressed={inCart ? undefined : checked}
                        >
                          {inCart ? null : checked ? <Check className="size-4" strokeWidth={2.5} /> : null}
                        </button>
                        <ProductCatalogExplorerThumb
                          photoUrl={p.photo_url}
                          productType={p.product_type}
                          productName={p.name}
                          className={cn(THUMB, "self-center")}
                          ringClassName={t.photoRing}
                          onOpenPreview={() =>
                            setPhotoPreview({
                              url: p.photo_url,
                              title: p.name,
                              brand: p.brand,
                              product_type: p.product_type,
                              descriptionHtml: productDescriptionHtmlForDisplay(p.full_description),
                              catalogExplorerPreview: true,
                            })
                          }
                        />
                        <button
                          type="button"
                          disabled={inCart}
                          onClick={() => toggleSelect(p)}
                          className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5 text-left disabled:cursor-not-allowed"
                        >
                          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={p.name}>
                            {p.name}
                          </p>
                          <ProductCatalogMetaLabel productType={p.product_type} brand={p.brand} />
                          <p className={cn("text-xs font-semibold leading-none", t.price)}>
                            <PriceDhInline
                              value={unitPrice}
                              amountClassName={cn("font-semibold", t.price)}
                              suffixClassName="text-[10px] font-semibold text-sky-700/70"
                            />
                          </p>
                          {inCart ? (
                            <span className="text-[10px] font-medium text-muted-foreground">{td("alreadyInRequest")}</span>
                          ) : null}
                        </button>
                      </div>
                    </li>
                  );
                })}
                {hasMore ? (
                  <li ref={loadMoreSentinelRef} className="px-3 py-3 text-center text-xs text-muted-foreground">
                    {loadingMore ? tc("loading") : td("scrollForMore")}
                  </li>
                ) : filtered.length > 0 ? (
                  <li className="px-3 py-2 text-center text-[10px] text-muted-foreground">{td("catalogEnd")}</li>
                ) : null}
              </ul>
            )}
          </div>
        </ProductRequestSection>
      </div>

      <PlatformStickyFooter tone="neutral" className={t.footerBorder}>
        <Button
          type="button"
          size="lg"
          disabled={selectedCount === 0 || adding}
          className={cn(uiActionBtnFull("h-11 text-sm"), t.cta)}
          onClick={() => addSelectedAndReturn()}
        >
          {addButtonLabel}
        </Button>
      </PlatformStickyFooter>

      <PatientProductPhotoPreviewModal
        open={photoPreview != null}
        imageUrl={photoPreview?.url ?? null}
        title={photoPreview?.title ?? ""}
        brand={photoPreview?.brand}
        productType={photoPreview?.product_type}
        descriptionHtml={photoPreview?.descriptionHtml}
        catalogExplorerPreview={photoPreview?.catalogExplorerPreview}
        onClose={() => setPhotoPreview(null)}
      />
    </main>
  );
}
