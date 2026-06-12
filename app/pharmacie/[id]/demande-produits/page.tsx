"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { filterUnifiedCatalogHitsExcludingKeys } from "@/lib/pharmacy-catalog-search";
import { searchPharmacyCatalog } from "@/lib/pharmacy-catalog-search";
import { mapUnifiedCatalogHitsPhotoUrls } from "@/lib/pharmacy-catalog-request-insert";
import type { UnifiedCatalogHit } from "@/lib/pharmacy-catalog-types";
import { supabase } from "@/lib/supabase";
import { PharmacyPublicBackLink } from "@/components/pharmacy/pharmacy-public-chrome";
import {
  PatientDemandeSendConfirmModal,
  PatientLineCommentModal,
  PriceDhInline,
  ProductRequestCartLineRow,
  ProductRequestCatalogHitRow,
  ProductRequestHeaderSearch,
  ProductRequestMessageCard,
  ProductRequestSection,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { Button } from "@/components/ui/button";
import {
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { cn } from "@/lib/utils";
import { DossierInlineActionPanel } from "@/components/requests/dossier-inline-action-panel";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX, REQUEST_CONVERSATION_MESSAGE_MAX } from "@/lib/patient-request-form-limits";
import { sendRequestConversationMessage } from "@/lib/send-request-conversation-message";
import type { ConversationAudioDraft } from "@/lib/use-conversation-audio-recorder";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { uiActionBtnFull, uiActionBtnFullOutline } from "@/lib/ui-action-buttons";
import {
  clearPatientDemandeProduitsDraft,
  draftLineUnitPrice,
  readPatientDemandeProduitsDraft,
  readPatientDemandeProduitsNote,
  writePatientDemandeProduitsDraft,
  type PatientDemandeProduitsDraftLine,
} from "@/lib/patient-demande-produits-draft";
import {
  buildManualRequestItemInsert,
  createManualDraftLineId,
  draftCartCatalogTotal,
  draftLineKey,
  normalizeManualProductLabel,
} from "@/lib/patient-manual-product-line";
import { PatientManualProductAddButton } from "@/components/catalog/patient-manual-product-add-button";
import { PatientManualProductModal } from "@/components/catalog/patient-manual-product-modal";
import { usePharmacyPricingForPatient } from "@/lib/pharmacy-pricing";
import { catalogHitToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import { usePharmacyPublicGate } from "@/lib/use-pharmacy-public-gate";

type ProductLite = UnifiedCatalogHit;

type CartLine = PatientDemandeProduitsDraftLine;

export default function DemandeProduitsPage() {
  const td = useTranslations("demandePublic");
  const tc = useTranslations("common");
  const tPharmacy = useTranslations("pharmacyPublic");
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const pharmacyId = typeof params.id === "string" ? params.id : "";

  const [sessionReady, setSessionReady] = useState(false);
  const [note, setNote] = useState("");
  const [pendingAudio, setPendingAudio] = useState<ConversationAudioDraft | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductLite[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [photoPreview, setPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const openPhotoPreview = useCallback(
    (
      url: string | null,
      title: string,
      descriptionHtml?: string | null,
      brand?: string | null,
      productType?: string | null,
      options?: { catalogExplorerPreview?: boolean }
    ) => {
      setPhotoPreview({
        url: url?.trim() || null,
        title: title.trim() || tc("product"),
        brand: brand ?? null,
        product_type: productType ?? null,
        descriptionHtml: productDescriptionHtmlForDisplay(descriptionHtml),
        catalogExplorerPreview: options?.catalogExplorerPreview ?? false,
      });
    },
    []
  );
  const [lineCommentModal, setLineCommentModal] = useState<{
    lineKey: string;
    productName: string;
    draft: string;
  } | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualModalPrefill, setManualModalPrefill] = useState("");
  const { resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId);
  const {
    pharmacyName,
    loading: pharmacyLoading,
    unavailable: pharmacyUnavailable,
  } = usePharmacyPublicGate(pharmacyId, sessionReady);

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
  const occupiedCatalogKeys = useMemo(() => new Set(lines.map(draftLineKey)), [lines]);
  const visibleHits = useMemo(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) return [];
    return filterUnifiedCatalogHitsExcludingKeys(hits, occupiedCatalogKeys);
  }, [debouncedQuery, hits, occupiedCatalogKeys]);

  useEffect(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS || !pharmacyId) {
      return;
    }
    const timer = setTimeout(() => {
      const run = async () => {
        const sanitized = sanitizeProductSearchQuery(debouncedQuery);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setHits([]);
          return;
        }
        setSearchLoading(true);
        try {
          const data = await searchPharmacyCatalog(supabase, pharmacyId, sanitized);
          setHits(
            mapUnifiedCatalogHitsPhotoUrls(data, (url) => resolvePublicMediaUrl(url) ?? url)
          );
        } catch (e) {
          setFeedback({
            type: "err",
            text: e instanceof Error ? e.message : "Recherche impossible.",
          });
          setHits([]);
        } finally {
          setSearchLoading(false);
        }
      };
      void run();
    }, 280);
    return () => clearTimeout(timer);
  }, [debouncedQuery, pharmacyId, td]);

  const addProduct = useCallback(
    (p: ProductLite) => {
      const unitPrice = resolveCatalogPrice(catalogHitToPricingInput(p));
      setLines((prev) => {
        if (prev.some((l) => l.product_id === p.id && (l.catalog_source ?? "global") === p.source)) {
          return prev;
        }
        return [
          ...prev,
          {
            product_id: p.id,
            catalog_source: p.source,
            name: p.name,
            brand: p.brand,
            product_type: p.product_type,
            photo_url: resolvePublicMediaUrl(p.photo_url),
            full_description: p.full_description ?? null,
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

  const setQty = (lineKey: string, qty: number) => {
    const q = Math.min(10, Math.max(1, qty));
    setLines((prev) => prev.map((l) => (draftLineKey(l) === lineKey ? { ...l, qty: q } : l)));
  };

  const removeLine = (lineKey: string) => {
    setLines((prev) => prev.filter((l) => draftLineKey(l) !== lineKey));
  };

  const addManualProduct = useCallback(
    (rawName: string) => {
      const name = normalizeManualProductLabel(rawName);
      if (name.length < 2) return;
      const key = `manual:${name.toLowerCase()}`;
      setLines((prev) => {
        if (prev.some((l) => draftLineKey(l) === key)) return prev;
        return [
          ...prev,
          {
            product_id: createManualDraftLineId(),
            catalog_source: "manual",
            name,
            photo_url: null,
            qty: 1,
          },
        ];
      });
      setQuery("");
      setHits([]);
      setFeedback(null);
      setManualModalOpen(false);
    },
    []
  );

  const openManualModal = useCallback((prefill = "") => {
    setManualModalPrefill(prefill || debouncedQuery);
    setManualModalOpen(true);
  }, [debouncedQuery]);

  const validateBeforeSend = (): string | null => {
    if (!pharmacyId) return td("pharmacyNotFound");
    if (lines.length === 0) return td("addAtLeastOne");
    for (const l of lines) {
      if (l.qty < 1 || l.qty > 10) return td("qtyRange");
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
      setFeedback({ type: "err", text: td("sessionExpired") });
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
      setFeedback({ type: "err", text: reqErr?.message ?? td("createFailed") });
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
        if ((l.catalog_source ?? "global") === "manual") {
          return { request_id: reqRow.id, ...buildManualRequestItemInsert(l) };
        }
        const cc = l.client_comment?.trim();
        const isPharmacy = l.catalog_source === "pharmacy";
        return {
          request_id: reqRow.id,
          line_product_kind: isPharmacy ? ("pharmacy" as const) : ("global" as const),
          product_id: isPharmacy ? null : l.product_id,
          pharmacy_product_id: isPharmacy ? l.product_id : null,
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

    const hasConvMessage = note.trim().length > 0 || pendingAudio != null;
    if (hasConvMessage) {
      const convResult = await sendRequestConversationMessage({
        supabase,
        requestId: reqRow.id,
        authorId: userData.user.id,
        authorRole: "patient",
        text: note,
        pendingAudio: pendingAudio ?? undefined,
      });
      if (!convResult.ok) {
        setSubmitLoading(false);
        setFeedback({
          type: "err",
          text: td("convFailed"),
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
  const totalAmount = useMemo(() => draftCartCatalogTotal(lines), [lines]);

  const saveLineComment = () => {
    if (!lineCommentModal) return;
    const trimmed = lineCommentModal.draft.trim();
    setLines((prev) =>
      prev.map((row) =>
        draftLineKey(row) === lineCommentModal.lineKey
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

  if (!sessionReady || pharmacyLoading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <p className="text-sm text-muted-foreground">{td("sessionCheck")}</p>
      </main>
    );
  }

  if (pharmacyUnavailable) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {tPharmacy("pharmacyUnavailable")}
        </div>
        <Link href="/" className="mt-4 block text-center text-sm font-medium text-primary">
          {tc("backToDirectory")}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen touch-pan-y bg-background text-foreground antialiased">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        <PharmacyPublicBackLink href={`/pharmacie/${pharmacyId}`} className={cn("mb-0", t.backLink)}>
          {td("backToProfile")}
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
                      key={`${p.source}:${p.id}`}
                      hit={{
                        id: p.id,
                        name: p.name,
                        brand: p.brand,
                        product_type: p.product_type,
                        photo_url: p.photo_url,
                        unitPrice: resolveCatalogPrice(catalogHitToPricingInput(p)),
                      }}
                      onAdd={() => addProduct(p)}
                      onPhotoPreview={() =>
                        openPhotoPreview(p.photo_url, p.name, p.full_description, p.brand, p.product_type, {
                          catalogExplorerPreview: true,
                        })
                      }
                    />
                  ))}
                </ul>
              ) : null}
              {debouncedQuery.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS && !searchLoading ? (
                <div className="mt-2 space-y-1.5">
                  {visibleHits.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{td("noResults")}</p>
                  ) : null}
                  <PatientManualProductAddButton query={debouncedQuery} onClick={() => openManualModal()} />
                </div>
              ) : null}
            </>
          }
        />

        <ProductRequestSection
          title={td("yourSelection")}
          hint={lines.length > 0 ? td("selectionHint") : undefined}
          badge={
            lines.length > 0 ? (
              <span className={cn("shrink-0", t.sectionBadge)}>
                {lines.length} {lines.length > 1 ? td("productPlural") : td("product")}
              </span>
            ) : null
          }
        >
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground">
              {td("emptySelection")}
            </p>
          ) : (
            <ul className="w-full min-w-0 space-y-2">
              {lines.map((l) => (
                <ProductRequestCartLineRow
                  key={draftLineKey(l)}
                  line={l}
                  unitPrice={draftLineUnitPrice(l)}
                  onRemove={() => removeLine(draftLineKey(l))}
                  onPhotoPreview={() =>
                    openPhotoPreview(l.photo_url, l.name, l.full_description, l.brand, l.product_type, {
                      catalogExplorerPreview: true,
                    })
                  }
                  onSetQty={(qty) => setQty(draftLineKey(l), qty)}
                  onOpenComment={() =>
                    setLineCommentModal({
                      lineKey: draftLineKey(l),
                      productName: l.name,
                      draft: l.client_comment ?? "",
                    })
                  }
                  hasComment={Boolean(l.client_comment?.trim())}
                />
              ))}
            </ul>
          )}
        </ProductRequestSection>

        <ProductRequestMessageCard
          note={note}
          onNoteChange={setNote}
          maxLength={REQUEST_CONVERSATION_MESSAGE_MAX}
          fieldFocus={fieldFocus}
          onAudioDraftChange={setPendingAudio}
        />

        {feedback ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              feedback.type === "ok"
                ? t.feedbackOk
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
            role="alert"
          >
            {feedback.text}
          </div>
        ) : null}

        <DossierInlineActionPanel
          tone="neutral"
          className={t.footerBorder}
          summaryLeft={
            <>
              <span className="font-bold tabular-nums text-foreground">{lines.length}</span>{" "}
              {lines.length > 1 ? td("productPlural") : td("product")}
            </>
          }
          summaryRight={
            lines.length > 0 && lines.every((l) => (l.catalog_source ?? "global") === "manual") ? (
              <span className="text-sm font-bold text-muted-foreground">—</span>
            ) : (
              <PriceDhInline
                value={totalAmount}
                amountClassName={cn("font-bold", t.price)}
                suffixClassName="font-bold text-sky-700/80"
              />
            )
          }
        >
          <Button
            type="button"
            size="lg"
            disabled={submitLoading || lines.length === 0}
            className={cn(uiActionBtnFull("h-11 text-base"), t.cta)}
            onClick={() => openSendConfirm()}
          >
            {submitLoading ? tc("sending") : td("sendRequest")}
          </Button>
        </DossierInlineActionPanel>

        <Link href="/dashboard/demandes" className={uiActionBtnFullOutline("flex h-11 items-center justify-center")}>
          {td("myProductRequests")}
        </Link>
      </div>

      <PatientDemandeSendConfirmModal
        open={sendConfirmOpen}
        lines={lines}
        note={note}
        audioDraft={pendingAudio}
        totalAmount={totalAmount}
        unitPriceForLine={draftLineUnitPrice}
        submitLoading={submitLoading}
        onClose={() => setSendConfirmOpen(false)}
        onConfirm={() => void performSubmit()}
        onPhotoPreview={openPhotoPreview}
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

      <PatientManualProductModal
        key={manualModalPrefill}
        open={manualModalOpen}
        initialName={manualModalPrefill}
        onClose={() => setManualModalOpen(false)}
        onConfirm={addManualProduct}
      />

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
