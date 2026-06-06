"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutGrid } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  markPatientDemandeCatalogueReturnEdit,
  mergeCatalogProductsIntoDraft,
  readPatientDemandeProduitsDraft,
  type PatientDemandeProduitsCatalogProduct,
  writePatientDemandeProduitsDraft,
} from "@/lib/patient-demande-produits-draft";
import { PharmacyPublicBackLink } from "@/components/pharmacy/pharmacy-public-chrome";
import {
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
import { ProductCatalogExplorerFilters } from "@/components/products/product-catalog-explorer-filters";
import { ProductCatalogExplorerListRow } from "@/components/products/product-catalog-explorer-list-row";
import { defaultProductCatalogExplorerFilters } from "@/lib/product-catalog-filters";
import { useCatalogDistinctBrands } from "@/lib/use-catalog-distinct-brands";
import { useProductCatalogExplorer } from "@/lib/use-product-catalog-explorer";

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
  const [catalogFilters, setCatalogFilters] = useState(defaultProductCatalogExplorerFilters);
  const [selectedById, setSelectedById] = useState<Map<string, PatientDemandeProduitsCatalogProduct>>(
    () => new Map()
  );
  const [photoPreview, setPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const [adding, setAdding] = useState(false);
  const loadMoreSentinelRef = useRef<HTMLLIElement>(null);
  const listScrollRef = useRef<HTMLUListElement>(null);
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);

  const { brands, loading: brandsLoading } = useCatalogDistinctBrands(sessionReady);

  const { products, loading, loadingMore, error: loadError, hasMore, loadMore } = useProductCatalogExplorer(
    sessionReady,
    filterQuery,
    catalogFilters
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
        "min-h-screen touch-pan-y bg-gradient-to-b from-sky-50/35 via-background to-background text-foreground antialiased",
        stickyFooterPadClass("standard")
      )}
    >
      <div className="mx-auto max-w-lg space-y-3 px-4 py-4 sm:px-5 sm:py-5">
        <PharmacyPublicBackLink href={backHref} className={cn("mb-0", t.backLink)}>
          {backLabel}
        </PharmacyPublicBackLink>

        <div
          className={cn(
            "flex items-start gap-3 rounded-2xl border border-sky-200/60 bg-gradient-to-br from-sky-50/80 via-card to-white px-4 py-3 shadow-sm",
            t.shell
          )}
        >
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1",
              t.accentIconBg,
              t.accentIcon
            )}
          >
            <LayoutGrid className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <h1 className="text-base font-bold leading-tight text-foreground">{td("explorerCatalogTitle")}</h1>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{td("explorerCatalogHint")}</p>
          </div>
        </div>

        <ProductRequestSection
          title={td("catalogBrowseSection")}
          hint={null}
          badge={
            selectedCount > 0 ? (
              <span className={cn("shrink-0", t.sectionBadge)}>
                {td(selectedCount > 1 ? "selectedCheckedPlural" : "selectedChecked", { count: selectedCount })}
              </span>
            ) : null
          }
        >
          <div className="space-y-2">
            <ProductRequestExplorerSearchBar
              query={filterQuery}
              onQueryChange={setFilterQuery}
              fieldFocus={fieldFocus}
              placeholder={td("catalogSearchPlaceholder")}
            />

            <ProductCatalogExplorerFilters
              filters={catalogFilters}
              onChange={setCatalogFilters}
              brands={brands}
              brandsLoading={brandsLoading}
              fieldFocus={fieldFocus}
            />

            <div className={cn("overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-sm", t.shell)}>
              {loadError ? <p className="px-3 py-3 text-sm text-destructive">{loadError}</p> : null}
              {!loading && !loadError ? (
                <p className="border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                  {filtered.length > 0
                    ? td(filtered.length > 1 ? "catalogResultsCountPlural" : "catalogResultsCount", {
                        count: filtered.length,
                      })
                    : td("catalogNoResultsHint")}
                </p>
              ) : null}
              {loading ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{tc("loading")}</p>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">{td("noProductsFound")}</p>
              ) : (
                <ul
                  ref={listScrollRef}
                  className="max-h-[min(52dvh,480px)] overflow-y-auto overscroll-y-contain touch-pan-y py-1"
                >
                  {filtered.map((p) => {
                    const inCart = cartProductIds.has(p.id);
                    const checked = !inCart && selectedById.has(p.id);
                    const unitPrice = resolveCatalogPrice(catalogHitToPricingInput(p));
                    return (
                      <ProductCatalogExplorerListRow
                        key={p.id}
                        product={p}
                        inCart={inCart}
                        checked={checked}
                        unitPrice={unitPrice}
                        onToggleSelect={() => toggleSelect(p)}
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
                        labels={{
                          alreadyInRequest: td("alreadyInRequest"),
                          selectAria: td("selectProductAria", { name: p.name }),
                          deselectAria: td("deselectProductAria", { name: p.name }),
                          inCartAria: td("alreadyInRequestAria", { name: p.name }),
                        }}
                      />
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
