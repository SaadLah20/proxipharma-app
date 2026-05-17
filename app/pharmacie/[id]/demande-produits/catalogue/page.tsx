"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronLeft, LayoutGrid, Package, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  filterCatalogProductsLocal,
  mergeCatalogProductsIntoDraft,
  readPatientDemandeProduitsDraft,
  type PatientDemandeProduitsCatalogProduct,
  writePatientDemandeProduitsDraft,
} from "@/lib/patient-demande-produits-draft";
import { Button, buttonVariants } from "@/components/ui/button";
import { PatientProductPhotoPreviewModal } from "@/components/requests/patient-product-photo-preview-modal";
import { cn } from "@/lib/utils";

const CATALOG_FETCH_LIMIT = 500;

function PriceDhInline({
  value,
  amountClassName,
}: {
  value: number | string | null | undefined;
  amountClassName?: string;
}) {
  if (value == null || value === "") return <span className={amountClassName}>—</span>;
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || n < 0) return <span className={amountClassName}>—</span>;
  return (
    <span className="inline-flex items-baseline whitespace-nowrap">
      <span className={cn("tabular-nums", amountClassName)}>{n.toFixed(2)}</span>
      <span className="translate-y-[0.02em] text-[0.62em] font-semibold uppercase leading-none tracking-tight text-slate-500">
        {"\u00A0"}DH
      </span>
    </span>
  );
}

function CatalogueBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "mb-3 -ml-2 inline-flex h-auto items-center gap-1 px-2 text-base font-semibold text-sky-900 underline-offset-2 hover:underline"
      )}
    >
      <ChevronLeft className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

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
  const [photoPreview, setPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const [adding, setAdding] = useState(false);

  const fieldFocus =
    "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

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
        .select("id,name,product_type,laboratory,photo_url,price_pph")
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

  const filtered = useMemo(
    () => filterCatalogProductsLocal(products, filterQuery),
    [products, filterQuery]
  );

  const selectableFiltered = useMemo(
    () => filtered.filter((p) => !cartProductIds.has(p.id)),
    [filtered, cartProductIds]
  );

  const toggleSelect = (productId: string) => {
    if (cartProductIds.has(productId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of selectableFiltered) next.add(p.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedCount = selectedIds.size;

  const addSelectedAndReturn = () => {
    if (!pharmacyId || selectedCount === 0) return;
    setAdding(true);
    const toAdd = products.filter((p) => selectedIds.has(p.id));
    const existing = readPatientDemandeProduitsDraft(pharmacyId, editRequestId);
    const merged = mergeCatalogProductsIntoDraft(existing, toAdd, resolvePublicMediaUrl);
    writePatientDemandeProduitsDraft(pharmacyId, merged, editRequestId);
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
    <main className="min-h-screen touch-pan-y bg-slate-50 p-4 pb-36 text-slate-900 antialiased sm:p-5 sm:pb-40">
      <div className="mx-auto max-w-lg">
        <CatalogueBackLink href={backHref} label={backLabel} />

        <section className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="size-5 shrink-0 text-sky-800" aria-hidden />
            <h1 className="text-base font-bold text-slate-950 sm:text-lg">Tous les produits</h1>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Cochez les produits à ajouter. Ceux déjà dans votre demande ne sont pas sélectionnables.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
            <input
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filtrer par nom ou laboratoire…"
              className={cn(
                "w-full rounded-xl border-2 border-slate-300 bg-white py-3 pl-11 pr-3 text-base leading-normal shadow-sm placeholder:text-slate-400",
                fieldFocus
              )}
            />
          </div>
        </section>

        <section className="mt-4 rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
              {loading ? (
                "Chargement…"
              ) : (
                <>
                  <span className="font-semibold tabular-nums text-slate-900">{filtered.length}</span> produit
                  {filtered.length > 1 ? "s" : ""}
                  {filterQuery.trim() ? " (filtrés)" : ""}
                </>
              )}
            </p>
            {!loading && selectableFiltered.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="text-xs font-semibold text-sky-900 underline-offset-2 hover:underline"
                  onClick={selectAllVisible}
                >
                  Tout sélectionner
                </button>
                {selectedCount > 0 ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
                    onClick={clearSelection}
                  >
                    Effacer la sélection
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          {loadError ? <p className="mt-3 text-sm text-destructive">{loadError}</p> : null}
          {!loading && filtered.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Aucun produit trouvé.</p>
          ) : (
            <ul className="mt-3 max-h-[min(52dvh,420px)] space-y-2 overflow-y-auto sm:max-h-[min(58dvh,480px)]">
              {filtered.map((p) => {
                const inCart = cartProductIds.has(p.id);
                const checked = !inCart && selectedIds.has(p.id);
                return (
                  <li key={p.id}>
                    <div
                      className={cn(
                        "flex min-h-[5rem] items-center gap-2.5 rounded-xl border px-2 py-2 transition",
                        inCart
                          ? "cursor-not-allowed border-slate-200 bg-slate-100/80 opacity-75"
                          : checked
                            ? "border-sky-400 bg-sky-50/60 ring-1 ring-sky-200"
                            : "border-border/70 bg-muted/20 hover:bg-muted/35"
                      )}
                    >
                      <button
                        type="button"
                        disabled={inCart}
                        onClick={() => toggleSelect(p.id)}
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 transition",
                          inCart
                            ? "border-slate-300 bg-slate-200"
                            : checked
                              ? "border-sky-600 bg-sky-600 text-white"
                              : "border-slate-300 bg-white hover:border-sky-400"
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
                        {inCart ? null : checked ? <Check className="size-5" strokeWidth={2.5} /> : null}
                      </button>
                      <button
                        type="button"
                        disabled={!p.photo_url}
                        className={cn(
                          "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card",
                          p.photo_url ? "cursor-zoom-in hover:ring-2 hover:ring-sky-400/50" : "cursor-default opacity-80"
                        )}
                        aria-label={p.photo_url ? `Agrandir la photo · ${p.name}` : "Pas de photo catalogue"}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          if (p.photo_url) setPhotoPreview({ url: p.photo_url, title: p.name });
                        }}
                      >
                        {p.photo_url ? (
                          <img src={p.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
                        ) : (
                          <Package className="size-5 text-muted-foreground" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={inCart}
                        onClick={() => toggleSelect(p.id)}
                        className="flex min-w-0 flex-1 flex-col justify-center text-left disabled:cursor-not-allowed"
                      >
                        <p
                          className="overflow-hidden pr-1 text-[14px] font-semibold leading-tight text-foreground sm:text-[15px]"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {p.name}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-sky-900 sm:text-sm">
                          <PriceDhInline value={p.price_pph} amountClassName="font-semibold text-sky-900" />
                        </p>
                        {inCart ? (
                          <span className="mt-1 inline-flex w-fit rounded-md bg-slate-200/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                            Déjà dans la demande
                          </span>
                        ) : null}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="mx-auto flex max-w-lg flex-col gap-2 px-4 sm:px-5">
          <p className="text-center text-sm text-slate-600">
            <span className="font-bold tabular-nums text-slate-950">{selectedCount}</span> sélectionné
            {selectedCount > 1 ? "s" : ""}
            {cartProductIds.size > 0 ? (
              <span className="text-slate-500">
                {" "}
                · {cartProductIds.size} déjà dans la demande
              </span>
            ) : null}
          </p>
          <Button
            type="button"
            size="lg"
            disabled={selectedCount === 0 || adding}
            className="h-12 w-full text-base font-semibold shadow-md"
            onClick={() => addSelectedAndReturn()}
          >
            {adding
              ? "Ajout…"
              : selectedCount > 0
                ? `Ajouter ${selectedCount} produit${selectedCount > 1 ? "s" : ""}${editRequestId ? " au dossier" : " à la demande"}`
                : "Sélectionnez des produits"}
          </Button>
          <Link
            href={backHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "flex h-11 w-full items-center justify-center text-sm font-semibold"
            )}
          >
            Retour sans ajouter
          </Link>
        </div>
      </div>

      <PatientProductPhotoPreviewModal
        open={photoPreview != null}
        imageUrl={photoPreview?.url ?? null}
        title={photoPreview?.title ?? ""}
        onClose={() => setPhotoPreview(null)}
      />
    </main>
  );
}
