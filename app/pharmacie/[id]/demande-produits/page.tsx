"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Minus, Plus, Trash2, Package, Search, X } from "lucide-react";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { supabase } from "@/lib/supabase";
import { Button, buttonVariants } from "@/components/ui/button";
import { PatientProductPhotoPreviewModal } from "@/components/requests/patient-product-photo-preview-modal";
import { cn } from "@/lib/utils";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX, REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  clearPatientDemandeProduitsDraft,
  draftLineUnitPrice,
  readPatientDemandeProduitsDraft,
  writePatientDemandeProduitsDraft,
  type PatientDemandeProduitsDraftLine,
} from "@/lib/patient-demande-produits-draft";
import { usePharmacyPricingForPatient } from "@/lib/pharmacy-pricing";
import { catalogHitToPricingInput } from "@/lib/pharmacy-pricing/product-embed";

type ProductLite = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
};

type CartLine = PatientDemandeProduitsDraftLine;

/** Montant + « DH » compact (suffixe plus petit, pas de coupure PU / nombre). */
function PriceDhInline({
  value,
  amountClassName,
  suffixClassName,
}: {
  value: number | string | null | undefined;
  amountClassName?: string;
  suffixClassName?: string;
}) {
  if (value == null || value === "") {
    return <span className={amountClassName}>—</span>;
  }
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || n < 0) {
    return <span className={amountClassName}>—</span>;
  }
  return (
    <span className="inline-flex items-baseline whitespace-nowrap">
      <span className={cn("tabular-nums", amountClassName)}>{n.toFixed(2)}</span>
      <span
        className={cn(
          "translate-y-[0.02em] text-[0.62em] font-semibold uppercase leading-none tracking-tight text-slate-500",
          suffixClassName
        )}
      >
        {"\u00A0"}
        DH
      </span>
    </span>
  );
}

export default function DemandeProduitsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [pharmacyName, setPharmacyName] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductLite[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);

  useEffect(() => {
    const gate = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace(`/auth?redirect=/pharmacie/${pharmacyId}/demande-produits`);
        return;
      }
      setSessionReady(true);
    };
    void gate();
  }, [router, pharmacyId]);

  useEffect(() => {
    if (!pharmacyId || !sessionReady) return;
    const loadPh = async () => {
      const { data } = await supabase.from("pharmacies").select("nom").eq("id", pharmacyId).maybeSingle();
      if (data?.nom) setPharmacyName(data.nom);
    };
    void loadPh();
  }, [pharmacyId, sessionReady]);

  const linesDraftKey = `${pharmacyId}|${sessionReady}|${pathname}`;
  const [prevLinesDraftKey, setPrevLinesDraftKey] = useState("");
  if (sessionReady && pharmacyId && pathname.endsWith("/demande-produits") && linesDraftKey !== prevLinesDraftKey) {
    setPrevLinesDraftKey(linesDraftKey);
    setLines(readPatientDemandeProduitsDraft(pharmacyId));
  }

  useEffect(() => {
    if (!pharmacyId || !sessionReady) return;
    if (!pathname.endsWith("/demande-produits")) return;
    writePatientDemandeProduitsDraft(pharmacyId, lines);
  }, [lines, pharmacyId, sessionReady, pathname]);

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visibleHits = debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS ? [] : hits;

  useEffect(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
      return;
    }
    const t = setTimeout(() => {
      const run = async () => {
        const sanitized = sanitizeProductSearchQuery(debouncedQuery);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setHits([]);
          return;
        }
        setSearchLoading(true);
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph,price_ppv")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);

        setSearchLoading(false);
        if (error) {
          setFeedback({ type: "err", text: error.message });
          setHits([]);
          return;
        }
        setHits(((data as ProductLite[]) ?? []).map((p) => ({
          ...p,
          photo_url: resolvePublicMediaUrl(p.photo_url),
        })));
      };
      void run();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = useCallback(
    (p: ProductLite) => {
      const unitPrice = resolveCatalogPrice(catalogHitToPricingInput(p));
      setLines((prev) => {
        if (prev.some((l) => l.product_id === p.id)) return prev;
        return [
          ...prev,
          {
            product_id: p.id,
            name: p.name,
            photo_url: resolvePublicMediaUrl(p.photo_url),
            qty: 1,
            unit_price: unitPrice,
          },
        ];
      });
      setQuery("");
      setHits([]);
      setFeedback(null);
    },
    [resolveCatalogPrice]
  );

  const setQty = (productId: string, qty: number) => {
    const q = Math.min(10, Math.max(1, qty));
    setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, qty: q } : l)));
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.product_id !== productId));
  };

  const validateBeforeSend = (): string | null => {
    if (!pharmacyId) return "Pharmacie introuvable.";
    if (lines.length === 0) return "Ajoute au moins un produit.";
    for (const l of lines) {
      if (l.qty < 1 || l.qty > 10) return "Chaque quantité doit être entre 1 et 10.";
    }
    return null;
  };

  const performSubmit = async () => {
    setFeedback(null);
    if (!pharmacyId) return;
    const v = validateBeforeSend();
    if (v) {
      setFeedback({ type: "err", text: v });
      return;
    }
    setSendConfirmOpen(false);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      setFeedback({ type: "err", text: "Session expirée. Reconnecte-toi." });
      return;
    }

    setSubmitLoading(true);
    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .insert({
        patient_id: userData.user.id,
        pharmacy_id: pharmacyId,
        request_type: "product_request",
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (reqErr || !reqRow) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: reqErr?.message ?? "Création de la demande impossible." });
      return;
    }

    const { error: prErr } = await supabase.from("product_requests").insert({
      request_id: reqRow.id,
      patient_note: null,
    });

    if (prErr) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: prErr.message });
      return;
    }

    const { error: itemsErr } = await supabase.from("request_items").insert(
      lines.map((l) => {
        const cc = l.client_comment?.trim();
        return {
          request_id: reqRow.id,
          product_id: l.product_id,
          requested_qty: l.qty,
          line_source: "patient_request" as const,
          client_comment: cc && cc.length > 0 ? cc.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) : null,
        };
      })
    );

    if (itemsErr) {
      setSubmitLoading(false);
      setFeedback({ type: "err", text: itemsErr.message });
      return;
    }

    const convTrim = note.trim().slice(0, REQUEST_CONVERSATION_MESSAGE_MAX);
    if (convTrim.length > 0) {
      const { error: convErr } = await supabase.from("request_comments").insert({
        request_id: reqRow.id,
        author_id: userData.user.id,
        author_role: "patient",
        comment_text: convTrim,
        is_internal: false,
      });
      if (convErr) {
        setSubmitLoading(false);
        setFeedback({
          type: "err",
          text:
            "Ta demande a bien été créée, mais le premier message n’a pas pu être enregistré. Ouvre « Conversation » sur le dossier pour le renvoyer.",
        });
        router.push(`/dashboard/demandes/${reqRow.id}`);
        return;
      }
      void supabase.rpc("mark_request_conversation_read", { p_request_id: reqRow.id });
    }

    setSubmitLoading(false);
    clearPatientDemandeProduitsDraft(pharmacyId);
    router.push(`/dashboard/demandes/${reqRow.id}`);
  };

  const openSendConfirm = () => {
    setFeedback(null);
    const err = validateBeforeSend();
    if (err) {
      setFeedback({ type: "err", text: err });
      return;
    }
    setSendConfirmOpen(true);
  };

  const fieldFocus =
    "outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";
  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (draftLineUnitPrice(l) ?? 0) * l.qty, 0),
    [lines]
  );

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen touch-pan-y bg-background p-4 pb-32 text-foreground antialiased sm:p-5 sm:pb-36">
      <div className="mx-auto max-w-lg space-y-3">
        <Link
          href={`/pharmacie/${pharmacyId}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 h-auto px-2 text-sm font-medium text-muted-foreground"
          )}
        >
          ← Pharmacie
        </Link>

        <header className="rounded-xl border-2 border-sky-300/50 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/30 px-3 py-3 shadow-md ring-1 ring-sky-200/55 sm:px-4 sm:py-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-900/90">Demande de produits</p>
          <div className="mt-1.5 flex items-center gap-3">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-900 ring-1 ring-sky-200/70"
              aria-hidden
            >
              <Package className="size-5" strokeWidth={2.25} />
            </span>
            <h1 className="min-w-0 text-lg font-bold leading-snug text-sky-950 sm:text-xl">
              {pharmacyName.trim() ? pharmacyName : "Cette pharmacie"}
            </h1>
          </div>
        </header>

        <section className="rounded-xl border-2 border-sky-200/70 bg-gradient-to-b from-white via-sky-50/25 to-white p-3 shadow-md ring-1 ring-sky-200/45 sm:p-4">
          <label className="block text-sm font-bold text-sky-950">Rechercher un produit</label>
          <p className="mt-0.5 text-xs font-medium text-sky-900/80">2 caractères minimum · nom ou laboratoire</p>
          <div className="relative mt-3">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-sky-700"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: Doliprane, Smecta..."
              className={cn(
                "touch-pan-y w-full rounded-xl border-2 border-sky-300/80 bg-white py-3.5 pl-11 pr-3 text-base leading-normal shadow-sm ring-2 ring-sky-100/80 placeholder:text-slate-400",
                fieldFocus
              )}
            />
          </div>
          <Link
            href={`/pharmacie/${pharmacyId}/demande-produits/catalogue`}
            onClick={() => writePatientDemandeProduitsDraft(pharmacyId, lines)}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-3 flex h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-sky-900"
            )}
          >
            <LayoutGrid className="size-4 shrink-0" aria-hidden />
            Voir tous les produits
          </Link>
          {searchLoading ? <p className="mt-2 text-xs text-muted-foreground">Recherche…</p> : null}
          {visibleHits.length > 0 ? (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {visibleHits.map((p) => (
                <li key={p.id}>
                  <div className="flex h-20 w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-2.5 py-2 transition hover:bg-muted/35">
                    <button
                      type="button"
                      disabled={!p.photo_url}
                      className={cn(
                        "flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-card transition",
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
                      onClick={() => addProduct(p)}
                      className="flex min-h-[5rem] min-w-0 flex-1 flex-col justify-center text-left"
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
                        <PriceDhInline
                          value={resolveCatalogPrice(catalogHitToPricingInput(p))}
                          amountClassName="font-semibold text-sky-900"
                        />
                      </p>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : debouncedQuery.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS && !searchLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border-l-4 border-sky-700 bg-sky-50/40 p-4 shadow-sm ring-1 ring-sky-200/50 sm:p-5">
          <h2 className="text-base font-semibold text-sky-950">Produits ajoutés</h2>
          {lines.length === 0 ? (
            <p className="mt-3 text-base leading-relaxed text-slate-700">Ajoutez un produit pour continuer.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {lines.map((l) => (
                <li
                  key={l.product_id}
                  className="rounded-xl border-2 border-slate-200 bg-gradient-to-b from-white to-slate-50/50 p-3 shadow-sm ring-1 ring-slate-100/90"
                >
                  <div className="flex min-h-[96px] items-stretch gap-2.5">
                    <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-card shadow-inner">
                      <button
                        type="button"
                        aria-label="Retirer"
                        className="absolute right-1 top-1 z-10 rounded-md bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive/10"
                        onClick={() => removeLine(l.product_id)}
                      >
                        <Trash2 size={15} />
                      </button>
                      {l.photo_url ? (
                        <button
                          type="button"
                          className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          aria-label={`Agrandir la photo · ${l.name}`}
                          onClick={() => setPhotoPreview({ url: l.photo_url!, title: l.name })}
                        >
                          <img src={l.photo_url} alt="" className="pointer-events-none h-full w-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="size-7 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p
                        className="overflow-hidden pr-1 text-[14px] font-semibold leading-snug text-slate-950 sm:text-[15px]"
                        style={{
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {l.name}
                      </p>
                      <div className="mt-1.5 flex flex-nowrap items-baseline justify-between gap-2 border-b border-slate-200/90 pb-2">
                        <span className="inline-flex min-w-0 shrink-0 items-baseline gap-0.5 text-[12px] text-slate-600 sm:text-[13px]">
                          <span className="shrink-0 font-semibold text-slate-500">PU</span>
                          <strong className="font-semibold text-slate-900">
                            <PriceDhInline value={draftLineUnitPrice(l)} />
                          </strong>
                        </span>
                        <span className="inline-flex shrink-0 items-baseline gap-0.5 text-[13px] font-bold text-sky-900 sm:text-sm">
                          <span className="shrink-0 font-semibold text-sky-800/90">Tot</span>
                          {draftLineUnitPrice(l) != null ? (
                            <PriceDhInline
                              value={(draftLineUnitPrice(l) ?? 0) * l.qty}
                              amountClassName="font-bold text-sky-900"
                              suffixClassName="text-sky-800/90"
                            />
                          ) : (
                            <span className="tabular-nums">—</span>
                          )}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-600">Qté</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            aria-label="Diminuer"
                            className="rounded-lg border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50"
                            onClick={() => setQty(l.product_id, l.qty - 1)}
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums">{l.qty}</span>
                          <button
                            type="button"
                            aria-label="Augmenter"
                            disabled={l.qty >= 10}
                            className="rounded-lg border border-slate-300 bg-white p-1.5 text-foreground shadow-sm hover:bg-slate-50 disabled:opacity-40"
                            onClick={() => setQty(l.product_id, l.qty + 1)}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-sm font-medium text-slate-800">Commentaire sur ce produit (facultatif)</span>
                    <input
                      type="text"
                      value={l.client_comment ?? ""}
                      maxLength={PATIENT_PRODUCT_LINE_COMMENT_MAX}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((row) =>
                            row.product_id === l.product_id
                              ? { ...row, client_comment: e.target.value.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) }
                              : row
                          )
                        )
                      }
                      placeholder="Ex. dosage, marque souhaitée…"
                      className={cn(
                        "w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-sm leading-normal placeholder:text-slate-400 [touch-action:pan-x_pan-y]",
                        fieldFocus
                      )}
                    />
                    <span className="mt-0.5 block text-right text-[9px] text-slate-400 tabular-nums">
                      {(l.client_comment ?? "").length}/{PATIENT_PRODUCT_LINE_COMMENT_MAX}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border/80 bg-card p-3 shadow-sm sm:p-4">
          <label className="block text-sm font-semibold text-foreground">Message pour la pharmacie (facultatif)</label>
          <p className="mt-0.5 text-xs text-muted-foreground">Visible dans la conversation du dossier après envoi.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, REQUEST_CONVERSATION_MESSAGE_MAX))}
            rows={4}
            maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
            className={cn(
              "mt-3 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-3 text-base leading-relaxed shadow-inner placeholder:text-slate-400 [touch-action:pan-x_pan-y]",
              fieldFocus
            )}
            placeholder="Ex. précisions utiles pour l’officine…"
          />
          <p className="mt-1 text-right text-[10px] text-slate-500 tabular-nums">
            {note.length}/{REQUEST_CONVERSATION_MESSAGE_MAX}
          </p>
        </section>

        {feedback ? (
          <div
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              feedback.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.text}
          </div>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Après envoi : <span className="font-medium text-foreground">Mes demandes de produits</span>
        </p>

        <Button
          type="button"
          size="lg"
          disabled={submitLoading || lines.length === 0}
          className="mt-4 h-12 w-full text-base font-semibold shadow-md"
          onClick={() => openSendConfirm()}
        >
          {submitLoading ? "Envoi…" : "Envoyer la demande"}
        </Button>

        <Link
          href="/dashboard/demandes"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "mt-3 flex h-12 w-full items-center justify-center text-base font-semibold"
          )}
        >
          Mes demandes de produits
        </Link>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-slate-300 bg-white/98 py-3 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/95">
        <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-5">
          <p className="text-base text-slate-700">
            <span className="font-bold tabular-nums text-slate-950">{lines.length}</span>{" "}
            <span className="font-medium">{lines.length > 1 ? "produits" : "produit"}</span>
          </p>
          <p className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1 text-lg font-bold tracking-tight text-slate-950">
            <span className="shrink-0">TOTAL:</span>
            <span className="text-sky-900">
              <PriceDhInline value={totalAmount} amountClassName="font-bold text-lg text-sky-900" suffixClassName="font-bold text-sky-800" />
            </span>
          </p>
        </div>
      </div>

      {sendConfirmOpen ? (
        <div className="fixed inset-0 z-[45] flex items-end justify-center p-3 sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fermer"
            disabled={submitLoading}
            onClick={() => !submitLoading && setSendConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-confirm-title"
            className="relative z-10 flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
              <h2 id="send-confirm-title" className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                {"Confirmer l'envoi"}
              </h2>
              <button
                type="button"
                disabled={submitLoading}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                onClick={() => setSendConfirmOpen(false)}
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
              <p className="text-xs leading-snug text-slate-600">
                {lines.length} produit{lines.length > 1 ? "s" : ""} · Les photos viennent du catalogue (sinon icône).
              </p>
              <ul className="mt-2 space-y-2">
                {lines.map((l) => (
                  <li
                    key={l.product_id}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                      {l.photo_url ? (
                        <button
                          type="button"
                          className="relative z-0 size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          aria-label={`Agrandir la photo · ${l.name}`}
                          onClick={() => setPhotoPreview({ url: l.photo_url!, title: l.name })}
                        >
                          <img src={l.photo_url} alt="" className="pointer-events-none size-full object-cover" />
                        </button>
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <Package className="size-5 text-slate-400" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{l.name}</p>
                      <div className="mt-0.5">
                        <p className="text-[11px] text-slate-600">
                          Qté <span className="font-bold tabular-nums text-slate-900">{l.qty}</span>
                        </p>
                        <div className="mt-0.5 flex flex-nowrap items-baseline justify-between gap-2">
                          <span className="inline-flex min-w-0 shrink items-baseline gap-0.5 text-[11px] text-slate-600">
                            <span className="shrink-0 font-semibold text-slate-500">PU</span>
                            <strong className="font-semibold text-slate-900">
                              <PriceDhInline value={draftLineUnitPrice(l)} amountClassName="text-[11px]" suffixClassName="text-[9px]" />
                            </strong>
                          </span>
                          <span className="inline-flex shrink-0 items-baseline gap-0.5 text-[11px] font-bold text-sky-900">
                            <span className="font-semibold text-sky-800/90">Tot</span>
                            {draftLineUnitPrice(l) != null ? (
                              <PriceDhInline
                                value={(draftLineUnitPrice(l) ?? 0) * l.qty}
                                amountClassName="text-[11px] font-bold"
                                suffixClassName="text-[9px] font-bold text-sky-800/90"
                              />
                            ) : (
                              <span className="tabular-nums">—</span>
                            )}
                          </span>
                        </div>
                        {l.client_comment?.trim() ? (
                          <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-slate-700">Votre commentaire</p>
                            <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-snug text-slate-800">
                              {l.client_comment.trim()}
                            </p>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {note.trim() ? (
                <p className="mt-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-2 py-1.5 text-[11px] text-slate-800">
                  <span className="font-semibold">Message : </span>
                  <span className="whitespace-pre-wrap">{note.trim().slice(0, 200)}{note.trim().length > 200 ? "…" : ""}</span>
                </p>
              ) : null}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">TOTAL</span>
                <span className="text-lg font-bold text-sky-900">
                  <PriceDhInline value={totalAmount} amountClassName="text-lg font-bold" suffixClassName="text-[0.65em] font-bold text-sky-800" />
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 flex-1 text-sm font-semibold"
                  disabled={submitLoading}
                  onClick={() => setSendConfirmOpen(false)}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  className="h-10 flex-1 text-sm font-semibold"
                  disabled={submitLoading}
                  onClick={() => void performSubmit()}
                >
                  {submitLoading ? "Envoi…" : "Confirmer l'envoi"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <PatientProductPhotoPreviewModal
        open={photoPreview != null}
        imageUrl={photoPreview?.url ?? null}
        title={photoPreview?.title ?? ""}
        onClose={() => setPhotoPreview(null)}
      />
    </main>
  );
}
