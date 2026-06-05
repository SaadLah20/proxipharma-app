"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  filterCatalogProductsLocal,
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

const CATALOG_FETCH_LIMIT = 500;
const THUMB = "box-border size-14 shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

export default function DemandeProduitsCataloguePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pharmacyId = typeof params.id === "string" ? params.id : "";
  const editRequestId = searchParams.get("requestId")?.trim() || undefined;
  const returnToParam = searchParams.get("returnTo")?.trim();

  const [sessionReady, setSessionReady] = useState(false);
  const [products, setProducts] = useState<PatientDemandeProduitsCatalogProduct[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [photoPreview, setPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const [adding, setAdding] = useState(false);
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);

  const fieldFocus = t.focus;

  const backHref =
    returnToParam && returnToParam.startsWith("/")
      ? returnToParam
      : editRequestId
        ? `/dashboard/demandes/${editRequestId}`
        : `/pharmacie/${pharmacyId}/demande-produits`;
  const backLabel = editRequestId ? "Retour au dossier" : "Retour à la demande";

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

  useEffect(() => {
    if (!sessionReady) return;
    const run = async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase
        .from("products")
        .select("id,name,product_type,laboratory,photo_url,price_pph,price_ppv,full_description")
        .eq("is_active", true)
        .order("name")
        .limit(CATALOG_FETCH_LIMIT);

      setLoading(false);
      if (error) {
        setLoadError(error.message);
        setProducts([]);
        return;
      }
      setProducts(
        ((data as PatientDemandeProduitsCatalogProduct[]) ?? []).map((p) => ({
          ...p,
          photo_url: resolvePublicMediaUrl(p.photo_url),
        }))
      );
    };
    void run();
  }, [sessionReady]);

  const filtered = useMemo(() => {
    const matched = filterCatalogProductsLocal(products, filterQuery);
    if (cartProductIds.size === 0) return matched;
    return matched.filter((p) => !cartProductIds.has(p.id));
  }, [products, filterQuery, cartProductIds]);

  const toggleSelect = (productId: string) => {
    if (cartProductIds.has(productId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectedCount = selectedIds.size;

  const addButtonLabel = (() => {
    if (adding) return "Ajout…";
    if (selectedCount === 0) return "Sélectionnez des produits";
    const suffix = editRequestId ? " au dossier" : " à la demande";
    return `Ajouter ${selectedCount} produit${selectedCount > 1 ? "s" : ""}${suffix}`;
  })();

  const addSelectedAndReturn = () => {
    if (!pharmacyId || selectedCount === 0) return;
    setAdding(true);
    const toAdd = products.filter((p) => selectedIds.has(p.id));
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
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
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
          title="Explorer le catalogue"
          hint="Filtrez par nom ou laboratoire, puis cochez les produits à ajouter."
          badge={
            selectedCount > 0 ? (
              <span className={cn("shrink-0", t.sectionBadge)}>{selectedCount} coché{selectedCount > 1 ? "s" : ""}</span>
            ) : null
          }
        >
          <ProductRequestExplorerSearchBar query={filterQuery} onQueryChange={setFilterQuery} fieldFocus={fieldFocus} />

          <div className={cn(pharmacyPublicCard, "mt-2 overflow-hidden p-0", t.shell)}>
            {loadError ? <p className="px-3 py-3 text-sm text-destructive">{loadError}</p> : null}
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun produit trouvé.</p>
            ) : (
              <ul className="max-h-[min(58dvh,520px)] divide-y divide-border/60 overflow-y-auto">
                {filtered.map((p) => {
                  const inCart = cartProductIds.has(p.id);
                  const checked = !inCart && selectedIds.has(p.id);
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
                          onClick={() => toggleSelect(p.id)}
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
                              ? `${p.name} — déjà dans la demande`
                              : checked
                                ? `Désélectionner ${p.name}`
                                : `Sélectionner ${p.name}`
                          }
                          aria-pressed={inCart ? undefined : checked}
                        >
                          {inCart ? null : checked ? <Check className="size-4" strokeWidth={2.5} /> : null}
                        </button>
                        <button
                          type="button"
                          disabled={!p.photo_url}
                          className={cn(
                            THUMB,
                            "self-center",
                            p.photo_url ? cn("cursor-zoom-in", t.photoRing) : "cursor-default opacity-80"
                          )}
                          aria-label={p.photo_url ? `Agrandir la photo · ${p.name}` : "Pas de photo catalogue"}
                          onClick={(ev) => {
                            ev.stopPropagation();
                            if (p.photo_url) {
                              setPhotoPreview({
                                url: p.photo_url,
                                title: p.name,
                                descriptionHtml: productDescriptionHtmlForDisplay(p.full_description),
                              });
                            }
                          }}
                        >
                          {p.photo_url ? (
                            <img src={p.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <Package className="size-5 text-muted-foreground" aria-hidden />
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={inCart}
                          onClick={() => toggleSelect(p.id)}
                          className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-0.5 text-left disabled:cursor-not-allowed"
                        >
                          <p className="truncate text-[13px] font-semibold leading-tight text-foreground" title={p.name}>
                            {p.name}
                          </p>
                          <p className={cn("text-xs font-semibold leading-none", t.price)}>
                            <PriceDhInline
                              value={unitPrice}
                              amountClassName={cn("font-semibold", t.price)}
                              suffixClassName="text-[10px] font-semibold text-sky-700/70"
                            />
                          </p>
                          {inCart ? (
                            <span className="text-[10px] font-medium text-muted-foreground">Déjà dans la demande</span>
                          ) : null}
                        </button>
                      </div>
                    </li>
                  );
                })}
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
        descriptionHtml={photoPreview?.descriptionHtml}
        onClose={() => setPhotoPreview(null)}
      />
    </main>
  );
}
