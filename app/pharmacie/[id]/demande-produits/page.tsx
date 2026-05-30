"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  filterCatalogHitsExcludingProductIds,
  productIdsFromLineProductIds,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { supabase } from "@/lib/supabase";
import { PharmacyPublicBackLink, pharmacyPublicCard } from "@/components/pharmacy/pharmacy-public-chrome";
import {
  PatientDemandeSendConfirmModal,
  PatientLineCommentModal,
  PriceDhInline,
  ProductRequestCartLineRow,
  ProductRequestCatalogHitRow,
  ProductRequestHeaderSearch,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { PatientProductPhotoPreviewModal } from "@/components/requests/patient-product-photo-preview-modal";
import { cn } from "@/lib/utils";
import {
  PlatformStickyFooter,
  PlatformStickyFooterSummaryRow,
} from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass } from "@/lib/platform-sticky-footer";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX, REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import {
  clearPatientDemandeProduitsDraft,
  draftLineUnitPrice,
  readPatientDemandeProduitsDraft,
  readPatientDemandeProduitsNote,
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
  const [lineCommentModal, setLineCommentModal] = useState<{
    productId: string;
    productName: string;
    draft: string;
  } | null>(null);
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);

  const pharmacyLabel = useMemo(() => pharmacyPublicLabel(pharmacyName), [pharmacyName]);

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
    const prefilledNote = readPatientDemandeProduitsNote(pharmacyId);
    if (prefilledNote) setNote(prefilledNote);
  }

  useEffect(() => {
    if (!pharmacyId || !sessionReady) return;
    if (!pathname.endsWith("/demande-produits")) return;
    writePatientDemandeProduitsDraft(pharmacyId, lines);
  }, [lines, pharmacyId, sessionReady, pathname]);

  const debouncedQuery = useMemo(() => query.trim(), [query]);
  const occupiedProductIds = useMemo(() => productIdsFromLineProductIds(lines), [lines]);
  const visibleHits = useMemo(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) return [];
    return filterCatalogHitsExcludingProductIds(hits, occupiedProductIds);
  }, [debouncedQuery, hits, occupiedProductIds]);

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

  const fieldFocus = t.focus;
  const totalAmount = useMemo(
    () => lines.reduce((sum, l) => sum + (draftLineUnitPrice(l) ?? 0) * l.qty, 0),
    [lines]
  );

  const saveLineComment = () => {
    if (!lineCommentModal) return;
    const trimmed = lineCommentModal.draft.trim();
    setLines((prev) =>
      prev.map((row) =>
        row.product_id === lineCommentModal.productId
          ? {
              ...row,
              client_comment:
                trimmed.length > 0 ? trimmed.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX) : undefined,
            }
          : row
      )
    );
    setLineCommentModal(null);
  };

  if (!sessionReady) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">Vérification de la session…</p>
      </main>
    );
  }

  return (
    <main className={cn("min-h-screen touch-pan-y bg-background p-4 text-foreground antialiased sm:p-5", stickyFooterPadClass("compact"))}>
      <div className="mx-auto max-w-lg space-y-3">
        <PharmacyPublicBackLink href={`/pharmacie/${pharmacyId}`} className={t.backLink}>
          Fiche officine
        </PharmacyPublicBackLink>

        <ProductRequestHeaderSearch
          pharmacyLabel={pharmacyLabel}
          pharmacyId={pharmacyId}
          query={query}
          onQueryChange={setQuery}
          searchLoading={searchLoading}
          explorerOnNavigate={() => writePatientDemandeProduitsDraft(pharmacyId, lines)}
          fieldFocus={fieldFocus}
          searchSlot={
            <>
              {visibleHits.length > 0 ? (
                <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                  {visibleHits.map((p) => (
                    <ProductRequestCatalogHitRow
                      key={p.id}
                      hit={{
                        id: p.id,
                        name: p.name,
                        photo_url: p.photo_url,
                        unitPrice: resolveCatalogPrice(catalogHitToPricingInput(p)),
                      }}
                      onAdd={() => addProduct(p)}
                      onPhotoPreview={() => {
                        if (p.photo_url) setPhotoPreview({ url: p.photo_url, title: p.name });
                      }}
                    />
                  ))}
                </ul>
              ) : debouncedQuery.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS && !searchLoading ? (
                <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
              ) : null}
            </>
          }
        />

        {lines.length === 0 ? (
          <p className="px-0.5 text-sm text-muted-foreground">Ajoutez un produit pour continuer.</p>
        ) : (
          <ul className="w-full min-w-0 space-y-1.5">
            {lines.map((l) => (
              <ProductRequestCartLineRow
                key={l.product_id}
                line={l}
                unitPrice={draftLineUnitPrice(l)}
                onRemove={() => removeLine(l.product_id)}
                onPhotoPreview={() => {
                  if (l.photo_url) setPhotoPreview({ url: l.photo_url, title: l.name });
                }}
                onSetQty={(qty) => setQty(l.product_id, qty)}
                onOpenComment={() =>
                  setLineCommentModal({
                    productId: l.product_id,
                    productName: l.name,
                    draft: l.client_comment ?? "",
                  })
                }
                hasComment={Boolean(l.client_comment?.trim())}
              />
            ))}
          </ul>
        )}

        <section className={cn(pharmacyPublicCard, "p-3 shadow-md sm:p-4", t.messageCard)}>
          <h2 className="text-sm font-bold text-foreground">Message pour la pharmacie</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Facultatif · visible dans la conversation après envoi.</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, REQUEST_CONVERSATION_MESSAGE_MAX))}
            rows={3}
            maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
            className={cn(
              "mt-2.5 w-full rounded-xl border-2 bg-background px-3 py-3 text-base leading-relaxed placeholder:text-muted-foreground [touch-action:pan-x_pan-y]",
              t.messageInput,
              fieldFocus
            )}
            placeholder="Ex. précisions utiles pour l’officine…"
          />
          <p className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground">
            {note.length}/{REQUEST_CONVERSATION_MESSAGE_MAX}
          </p>
        </section>

        {feedback ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              feedback.type === "ok"
                ? t.feedbackOk
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {feedback.text}
          </div>
        ) : null}

        <Button
          type="button"
          size="lg"
          disabled={submitLoading || lines.length === 0}
          className={cn("h-12 w-full text-base font-semibold", t.cta)}
          onClick={() => openSendConfirm()}
        >
          {submitLoading ? "Envoi…" : "Envoyer la demande"}
        </Button>

        <Link
          href="/dashboard/demandes"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "flex h-11 w-full items-center justify-center text-sm font-semibold"
          )}
        >
          Mes demandes de produits
        </Link>
      </div>

      <PlatformStickyFooter tone="sky" className={t.footerBorder}>
        <PlatformStickyFooterSummaryRow
          left={
            <>
              <span className="font-bold tabular-nums text-foreground">{lines.length}</span>{" "}
              {lines.length > 1 ? "produits" : "produit"}
            </>
          }
          right={
            <PriceDhInline
              value={totalAmount}
              amountClassName={cn("font-bold", t.price)}
              suffixClassName="font-bold text-sky-600/80"
            />
          }
        />
      </PlatformStickyFooter>

      <PatientDemandeSendConfirmModal
        open={sendConfirmOpen}
        lines={lines}
        note={note}
        totalAmount={totalAmount}
        unitPriceForLine={draftLineUnitPrice}
        submitLoading={submitLoading}
        onClose={() => setSendConfirmOpen(false)}
        onConfirm={() => void performSubmit()}
        onPhotoPreview={(url, title) => setPhotoPreview({ url, title })}
      />

      <PatientLineCommentModal
        open={lineCommentModal != null}
        productName={lineCommentModal?.productName ?? ""}
        value={lineCommentModal?.draft ?? ""}
        onChange={(draft) =>
          setLineCommentModal((prev) => (prev ? { ...prev, draft } : null))
        }
        onClose={() => setLineCommentModal(null)}
        onSave={saveLineComment}
      />

      <PatientProductPhotoPreviewModal
        open={photoPreview != null}
        imageUrl={photoPreview?.url ?? null}
        title={photoPreview?.title ?? ""}
        onClose={() => setPhotoPreview(null)}
      />
    </main>
  );
}
