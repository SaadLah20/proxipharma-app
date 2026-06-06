"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  CalendarClock,
  ChevronDown,
  Layers,
  Mail,
  MessageCircle,
  MessageSquare,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";
import {
  lineConversationVisual,
  PharmacistLineConversationModal,
  PharmacistLineMessageButton,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
import {
  pharmacistRequestCatalogProductBlockMessageFr,
  pharmacistRequestCatalogProductIdBlocked,
} from "@/lib/pharmacist-request-catalog-product-block";
import { supabase } from "@/lib/supabase";
import { formatDateShortFr, formatDateTimeShort24hFr, archiveTerminalFootnoteFr } from "@/lib/datetime-fr";
import {
  PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS,
  pharmacistAvailabilityOptionsForLine,
  PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS,
  inferAvailabilityStatusFromQty,
  pharmacistSupplyDraftNeedsReceptionDate,
} from "@/lib/pharmacist-availability";
import { SUPPLY_AMEND_CHANNEL_OPTIONS } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  pharmacistRequestIsClosedSuccess,
  pharmacistRequestIsHardStopped,
  requestItemLineSourceFr,
  requestStatusFr,
} from "@/lib/request-display";
import { displayRequestPublicRef } from "@/lib/public-ref";
import {
  formatCounterOutcomeHistoryReason,
  pharmacistDossierHistoryDetailParagraphsFr,
  pharmacistHardStopMotifSummaryFr,
  stringifyPharmaConfirmAudit,
  type PharmaConfirmAdjustmentAudit,
  type PharmaConfirmAdjustmentLine,
} from "@/lib/patient-request-history-audit";
import {
  pharmacistClosedSuccessIntro,
  pharmacistHardStopSectionCopy,
} from "@/lib/request-kinds/hub-and-terminal-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { getRequestKindWorkflowCopy } from "@/lib/request-kinds/workflow-copy";
import {
  requestUsesProductLineWorkflow,
  sharedShowPlannedVisitBlock,
} from "@/lib/request-kinds/shared-capabilities";
import { formatPlannedVisitFr } from "@/lib/datetime-fr";
import { findTerminalStatusHistoryEntry } from "@/lib/patient-archive-outcome-fr";
import { RequestDetailBackLink } from "@/components/requests/shared/request-detail-back-link";
import { RequestKindHeader } from "@/components/requests/shared/request-kind-header";
import { ConsultationRequestDetailChrome } from "@/components/requests/consultation/consultation-request-detail-chrome";
import { RequestConversationInline } from "@/components/requests/request-conversation-inline";
import {
  getConsultationDefaultTab,
  type ConsultationDetailTab,
} from "@/lib/consultation-detail-tabs";
import { PrescriptionScanCollapsible } from "@/components/requests/prescription/prescription-scan-collapsible";
import { PharmacistOrdonnanceQuickAddModal, type OrdonnanceModalAlternativePick } from "@/components/requests/prescription/pharmacist-ordonnance-quick-add-modal";
import {
  isPrescriptionOrdonnancePharmacistLine,
  isPrescriptionOrdonnancePrincipalLine,
  isPrescriptionAdditionalProposedLine,
  isProductRequestAjoutOfficineLine,
  isProposedLineForAvailabilityInference,
  PRESCRIPTION_ADDITIONAL_PROPOSED_REASON,
} from "@/lib/prescription-pharmacist-lines";
import { inferArchiveSnapshotStatus } from "@/lib/request-archive-snapshot-status";
import { pharmacistCanEditLineProductNotes } from "@/lib/request-line-notes-policy";
import { prescriptionLineRequiresPatientConsent } from "@/lib/prescription-patient-labels";
import {
  applyOrdonnanceAvailabilityChange,
  applyOrdonnanceAvailableQtyChange,
  applyOrdonnanceRequestedQtyChange,
  clampOrdonnanceRequestedQty,
  nudgeOrdonnanceAvailableQty,
  nudgeOrdonnanceRequestedQty,
  inferOrdonnanceLineAvailabilityStatus,
  ordonnanceDraftRequestedQty,
  ordonnanceInsertAvailableQty,
} from "@/lib/prescription-ordonnance-line-qty";
import type { ConsultationImagePaths } from "@/lib/consultation-media";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";
import { one } from "@/lib/embed";
import { formatPharmacyCatalogPrice, formatPharmacyLinePrice, formatPriceDh } from "@/lib/product-price";
import { usePharmacyPricing, type PharmacyPricingConfig } from "@/lib/pharmacy-pricing";
import { resolvePharmacyUnitPrice } from "@/lib/pharmacy-pricing/resolve";
import { catalogHitToPricingInput, productEmbedToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import { mapRequestItemRowPhotos, mapRequestItemsPhotos, resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { PageShell } from "@/components/ui/compact-shell";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { PolishedOptionPicker } from "@/components/ui/polished-option-picker";
import { Z_STICKY_FOOTER } from "@/lib/ui-z-index";
import {
  PlatformStickyFooter,
  PlatformStickyFooterStack,
  PlatformStickyFooterStackRow,
} from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass, consultationConversationViewportHeightClass } from "@/lib/platform-sticky-footer";
import {
  PHARMA_LINE_EDITOR_ALTS,
  PHARMA_LINE_EDITOR_CARD,
  PHARMA_LINE_EDITOR_CONTROLS,
  PHARMA_LINE_EDITOR_HEADER,
  PHARMA_STATUS_BANNER,
} from "@/lib/ui-density";
import { InfoHint } from "@/components/ui/info-hint";
import {
  PharmacistCloseRequestConfirmModal,
  type PharmacistCloseRequestSummary,
} from "@/components/pharmacist/pharmacist-close-request-confirm-modal";
import { PharmacistDeclareTreatedConfirmModal } from "@/components/pharmacist/pharmacist-declare-treated-confirm-modal";
import { PharmacistArchiveFrozenProductsView } from "@/components/pharmacist/pharmacist-archive-frozen-products-view";
import { PharmacistClosedProductBucketsView } from "@/components/pharmacist/pharmacist-closed-product-buckets-view";
import {
  computeSelFromConfirmedItems,
  computeSelFromItems,
} from "@/components/requests/product/patient-product-request-actions";
import { patientClosedArchiveLineBucket } from "@/lib/patient-closed-archive-line-buckets";
import type { PatientClosedArchiveLineBucketId } from "@/lib/patient-closed-archive-line-buckets";
import {
  PharmacistClosedArchiveNotRetainedLine,
  PharmacistClosedArchiveValidatedLine,
  closedArchiveDescriptionHtml,
  closedArchiveLinePricing,
  closedArchiveThumbUrl,
  validatedProductLabel as closedArchiveProductLabel,
} from "@/components/pharmacist/pharmacist-closed-archive-line";
import {
  buildPharmacistDeclareTreatedSummary,
  pharmacistActiveRetainedLineCount,
} from "@/lib/pharmacist-declare-treated-fr";
import {
  flattenPharmacistSupplyListEntriesStable,
  sortPharmacistSupplyRowsBySection,
} from "@/lib/pharmacist-supply-list-order";
import {
  validatedBranchUnitPriceMad,
  validatedBranchDescriptionHtml,
  validatedBranchPhotoPath,
  validatedProductBrand,
  validatedProductLabel,
  validatedQtyForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import { buildPatientLineTimelineFr, postConfirmSupplyAmendmentBadgeLabelsFr } from "@/lib/build-patient-line-timeline-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { DossierHistoryListFr } from "@/components/requests/dossier-history-list-fr";
import { RequestConversationFabDock, RequestConversationPanel } from "@/components/requests/request-conversation-panel";
import {
  PharmacistSupplyCompactLine,
  type PharmacistSupplyLineTier,
} from "@/components/pharmacist/pharmacist-supply-compact-line";
import { PharmacistValidatedBucketSection } from "@/components/pharmacist/pharmacist-validated-bucket-section";
import {
  buildPharmacistValidatedBucketGroups,
  compactTotalMadLabel,
  monetaryTotalsForRetainedLines,
  supplyTierForBucketKind,
  type PharmacistValidatedBucketGroup,
} from "@/lib/pharmacist-validated-bucket-layout";
import {
  buildPatientValidatedLineLabelsFr,
  validatedOriginLabelPharmacistFr,
} from "@/lib/patient-validated-line-labels-fr";
import { patientPrescriptionLineBadge } from "@/lib/prescription-patient-labels";
import {
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
} from "@/components/requests/patient-product-photo-preview-modal";
import { PharmacistProductPhotoThumb } from "@/components/pharmacist/pharmacist-product-photo-thumb";
import { ProductBrandLabel } from "@/components/products/product-brand-label";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { PharmacistProductRequestDossierHeader } from "@/components/requests/product/pharmacist-product-request-dossier-header";
import { patientBucketProductListClass } from "@/lib/patient-bucket-product-row-ui";
import {
  pharmacistProductDossierPageClass,
  pharmacistProductLinesWrapperClass,
  pharmacistProductPlannedVisitClass,
  pharmacistProductSecondaryBannerClass,
  pharmacistProductSectionTitleClass,
} from "@/lib/pharmacist-product-dossier-shell";
import { PharmacistAltCatalogPicker } from "@/components/pharmacist/pharmacist-alt-catalog-picker";
import { PharmacistAlternativeLinePanel } from "@/components/pharmacist/pharmacist-alternative-line-panel";
import { PharmacistLineAlternativesTabs } from "@/components/pharmacist/pharmacist-line-alternatives-tabs";
import { PharmacienAvailabilityDropdown } from "@/components/pharmacist/pharmacien-availability-dropdown";
import {
  PRODUCT_REQUEST_LINE_CARD_SHELL,
  ProductRequestLineQtyPicker,
  ProductRequestLineQtyReadonly,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { pharmacistSentProductLineQtyUi } from "@/lib/pharmacist-sent-product-line-qty";
import {
  inferredAvailabilityForPharmacistPublish,
  PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR,
  pharmacistPublishMissingReceptionDateProductNames,
} from "@/lib/pharmacist-publish-reception-date";
import {
  uiActionBtnFull,
  uiActionBtnModalOutline,
  uiActionBtnModalPrimary,
  uiActionBtnSmPrimary,
} from "@/lib/ui-action-buttons";
import {
  PHARMACIST_ALT_TAB_ADD,
  pharmacistAltTabLabel,
  type PharmacistLineAltTabId,
} from "@/lib/pharmacist-line-alt-tabs";
import {
  pharmacistCanCompleteCounterClosure,
  pharmacistCounterPickedUpCount,
  pharmacistCounterTrackedLines,
  pharmacistCounterUnresolvedLines,
} from "@/lib/pharmacist-counter-closure";
import { type SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import {
  buildLineAddedAfterConfirmAmendment,
  isRequestItemAddedAfterPatientConfirmation,
  POST_CONFIRM_LINE_ADDED_BADGE_FR,
} from "@/lib/supply-line-post-confirm";
import { PlannedVisitDateInput } from "@/components/requests/planned-visit-date-input";
import {
  assertReceptionDateNotBeforeToday,
  receptionDateMaxYmd,
  todayLocalIsoDate,
} from "@/lib/planned-visit";
import { clampPharmacistAlternativeOfferedQty as clampAlternativeAvailableQty } from "@/lib/alternative-qty-rules";
import {
  dispatchRequestDetailRefresh,
  REQUEST_DETAIL_REFRESH_EVENT,
  type RequestDetailRefreshDetail,
} from "@/lib/request-detail-refresh-bus";
import { useRequestDetailDrift } from "@/lib/use-request-detail-drift";
type RequestRow = {
  id: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  patient_id: string;
  created_at: string;
  submitted_at: string | null;
  responded_at: string | null;
  confirmed_at: string | null;
  updated_at: string;
  patient_planned_visit_date: string | null;
  patient_planned_visit_time: string | null;
  request_public_ref?: string | null;
};

type ProdEmbedDb = {
  name: string;
  product_type?: string | null;
  brand?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  photo_url?: string | null;
  full_description?: string | null;
};

type AltRowDb = {
  id: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
};

type ItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  client_comment: string | null;
  line_source: string | null;
  pharmacist_proposal_reason: string | null;
  expected_availability_date: string | null;
  counter_outcome: string;
  counter_cancel_reason: string | null;
  counter_cancel_detail: string | null;
  is_selected_by_patient: boolean;
  selected_qty: number | null;
  patient_chosen_alternative_id?: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
  updated_at: string;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
  request_item_alternatives: AltRowDb | AltRowDb[] | null;
};

type ItemDraft = {
  availability_status: string;
  available_qty: string;
  /** Qté prescrite (médecin) — lignes ordonnance saisies par le pharmacien. */
  requested_qty_str?: string;
  unit_price: string;
  pharmacist_comment: string;
  expected_availability_date: string;
  withdrawn_after_confirm: boolean;
  /** Quantité retenue avec le patient (lignes sélectionnées, après validation). */
  selected_qty_str: string;
  /** Brouillon jusqu’à « Enregistrer les modifications » (aligné sur `post_confirm_fulfillment`). */
  fulfillment_draft: "unset" | "reserved" | "ordered" | "arrived_reserved";
  counter_outcome_draft: string;
  counter_cancel_reason_draft: string | null;
  counter_cancel_detail_draft: string | null;
};

type Draft = Record<string, ItemDraft>;

const PHARMA_REQUEST_ITEMS_SELECT =
  "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,line_source,pharmacist_proposal_reason,client_comment,updated_at,products(name,product_type,brand,laboratory,price_pph,price_ppv,photo_url,full_description),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,product_type,brand,laboratory,price_pph,price_ppv,photo_url,full_description))";

function rowsWithEffectiveWithdrawnForSupply(rows: ItemRow[], d: Draft): ItemRow[] {
  return rows.map((row) => {
    const f = d[row.id];
    const effective = Boolean(row.withdrawn_after_confirm) || Boolean(f?.withdrawn_after_confirm);
    if (effective === Boolean(row.withdrawn_after_confirm)) return row;
    return { ...row, withdrawn_after_confirm: effective };
  });
}

/** Ligne + brouillon officine pour pastilles statut (aligné sur la dispo affichée). */
function rowForValidatedLineLabels(
  row: ItemRow,
  f: ItemDraft | undefined,
  requestType: string
): PatientLineLike {
  if (!f) return row as PatientLineLike;
  const eff = effectiveAvailSupplyDraft(row, f, requestType);
  const eta = effectiveEtaSupplyDraft(row, f, requestType);
  const inf = eff ?? f.availability_status ?? row.availability_status ?? "";
  let pcf = f.fulfillment_draft ?? row.post_confirm_fulfillment ?? "unset";
  pcf = clampFulfillmentDraftToInferred(pcf, inf);
  return {
    ...(row as PatientLineLike),
    availability_status: eff ?? f.availability_status ?? row.availability_status,
    expected_availability_date: eta ?? f.expected_availability_date ?? row.expected_availability_date,
    post_confirm_fulfillment: pcf,
  };
}

/** Ligne + brouillon officine pour classement bucket validé (aligné labels). */
function rowForValidatedSupplyBucket(row: ItemRow, d: Draft, requestType: string): PatientLineLike {
  const f = d[row.id];
  if (!f) return row as PatientLineLike;
  return rowForValidatedLineLabels(row, f, requestType);
}

type ProductCatalogHit = {
  id: string;
  name: string;
  product_type: string;
  brand: string | null;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  full_description?: string | null;
};

type PatientBrief = {
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
};

function patientHeadingName(profile: PatientBrief | null, patientId: string): string {
  const n = profile?.full_name?.trim();
  if (n) return n;
  return `Patient #${formatShortId(patientId)}`;
}

function telHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return `tel:${digits}`;
  return `tel:${raw.trim()}`;
}

function whatsappHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `https://wa.me/${digits}`;
}

function smsHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `sms:${digits}`;
}

function normalizeAlts(raw: ItemRow["request_item_alternatives"]): AltRowDb[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return [...list].sort((a, b) => a.rank - b.rank);
}

function clampFulfillmentDraftToInferred(
  fd: "unset" | "reserved" | "ordered" | "arrived_reserved",
  inferredAvail: string
): "unset" | "reserved" | "ordered" | "arrived_reserved" {
  let x = fd;
  if (x === "reserved" && !["available", "partially_available"].includes(inferredAvail)) x = "unset";
  if ((x === "ordered" || x === "arrived_reserved") && inferredAvail !== "to_order") x = "unset";
  return x;
}

/** Après passage en « à commander », le brouillon suit « commandé » pour afficher « reçu en officine ». */
function fulfillmentDraftAfterAvailabilityChange(
  current: "unset" | "reserved" | "ordered" | "arrived_reserved",
  inferredAvail: string
): "unset" | "reserved" | "ordered" | "arrived_reserved" {
  let fd = clampFulfillmentDraftToInferred(current, inferredAvail);
  if (inferredAvail === "to_order" && fd === "unset") fd = "ordered";
  return fd;
}

/** Disponibilité dérivée du brouillon en cours d’enregistrement (alignée sur `buildItemUpdatePayload`). */
function inferredAvailabilityForPostConfirmClamp(_row: ItemRow, payloadInferred: string): string {
  return payloadInferred;
}

function fulfillmentDraftFromRow(row: ItemRow): "unset" | "reserved" | "ordered" | "arrived_reserved" {
  const p = row.post_confirm_fulfillment ?? "unset";
  if (p === "reserved") return "reserved";
  if (p === "arrived_reserved") return "arrived_reserved";
  if (p === "ordered") return "ordered";
  return "unset";
}

function nextAltRank(existing: AltRowDb[]): number | null {
  const used = new Set(existing.map((a) => a.rank));
  for (let r = 1; r <= 3; r += 1) {
    if (!used.has(r)) return r;
  }
  return null;
}

const LOCAL_PROPOSED_ID_PREFIX = "__pp_local:";
const LOCAL_ALT_ID_PREFIX = "__alt_local:";

function isLocalProposedItemId(rowId: string) {
  return rowId.startsWith(LOCAL_PROPOSED_ID_PREFIX);
}

function isLocalAltId(altId: string) {
  return altId.startsWith(LOCAL_ALT_ID_PREFIX);
}

function newLocalProposedId() {
  return `${LOCAL_PROPOSED_ID_PREFIX}${crypto.randomUUID()}`;
}

function newLocalAltId() {
  return `${LOCAL_ALT_ID_PREFIX}${crypto.randomUUID()}`;
}

const PHARMACIST_SUPPLY_SURFACE_MAIN =
  "rounded-lg border border-emerald-300/70 bg-gradient-to-b from-emerald-50/40 via-white to-white p-1.5 shadow-sm ring-1 ring-emerald-200/50 sm:p-2";
const PHARMACIST_SUPPLY_SURFACE_SECOND =
  "rounded-lg border border-teal-300/70 bg-gradient-to-b from-teal-50/35 via-white to-white p-1.5 shadow-sm ring-1 ring-teal-200/50 sm:p-2";
const PHARMACIST_SUPPLY_SURFACE_NEUTRAL =
  "rounded-lg border border-slate-200/85 bg-gradient-to-b from-slate-50/55 via-white to-white p-1.5 shadow-sm ring-1 ring-slate-200/55 sm:p-2";

type PendingAlternativeEntry = {
  localAltId: string;
  parentItemId: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdEmbedDb | ProdEmbedDb[] | null;
};

function pendingAltsAsRankedDb(prev: PendingAlternativeEntry[], parentId: string): AltRowDb[] {
  return [...prev]
    .filter((p) => p.parentItemId === parentId)
    .sort((a, b) => a.rank - b.rank)
    .map(
      (e): AltRowDb => ({
        id: e.localAltId,
        rank: e.rank,
        product_id: e.product_id,
        availability_status: e.availability_status,
        available_qty: e.available_qty,
        unit_price: e.unit_price,
        pharmacist_comment: e.pharmacist_comment,
        expected_availability_date: e.expected_availability_date,
        products: e.products,
      })
    );
}

/** Alternatives encore non persistées, fusion de la ligne vue écran. */
function mergePendingAlternativesOntoRows(rows: ItemRow[], pendingAlternatives: PendingAlternativeEntry[]): ItemRow[] {
  return rows.map((row) => {
    const extra = pendingAltsAsRankedDb(pendingAlternatives, row.id);
    if (extra.length === 0) return row;
    const existing = normalizeAlts(row.request_item_alternatives);
    const merged = [...existing, ...extra].sort((a, b) => a.rank - b.rank);
    return { ...row, request_item_alternatives: merged };
  });
}

/** Alternatives marquées pour retrait au prochain enregistrement (brouillon). */
function applyPendingAlternativeDeletesToRows(
  rows: ItemRow[],
  pendingDeletedAlternativeIds: string[]
): ItemRow[] {
  if (pendingDeletedAlternativeIds.length === 0) return rows;
  const del = new Set(pendingDeletedAlternativeIds);
  return rows.map((row) => {
    const alts = normalizeAlts(row.request_item_alternatives).filter((a) => !del.has(a.id));
    if (alts.length === normalizeAlts(row.request_item_alternatives).length) return row;
    return { ...row, request_item_alternatives: alts };
  });
}

function counterOutcomeLabelPharmacien(outcome: string, cancelReason: string | null = null): string {
  if (outcome === "cancelled_at_counter") {
    if (cancelReason === "client_request") return "Annulé à la demande du client";
    if (cancelReason === "pharmacy_unable") return "Annulé par la pharmacie";
    return "Annulé";
  }
  switch (outcome) {
    case "unset":
      return "En attente";
    case "picked_up":
      return "Récupéré";
    case "deferred_next_visit":
      return "En attente";
    default:
      return counterOutcomeFr[outcome] ?? outcome;
  }
}

/** Comptoir figé en base (ne plus modifier via le brouillon). */
function counterOutcomeFrozenInDb(row: ItemRow): boolean {
  const co = row.counter_outcome ?? "unset";
  return co === "picked_up" || co === "cancelled_at_counter";
}

/** Sélecteur comptoir : seulement en attente / récupéré (legacy « plus tard » → en attente). */
function counterSelectKeyNormalized(row: ItemRow, f: ItemDraft): "picked_up" | "unset" {
  if (counterOutcomeFrozenInDb(row)) {
    return row.counter_outcome === "picked_up" ? "picked_up" : "unset";
  }
  const raw = f.counter_outcome_draft ?? row.counter_outcome ?? "unset";
  if (raw === "picked_up") return "picked_up";
  return "unset";
}

function normalizeCounterOutcomeForPersist(row: ItemRow, f: ItemDraft): { outcome: string; cancelReason: null; cancelDetail: null } | null {
  if (counterOutcomeFrozenInDb(row)) return null;
  const raw = f.counter_outcome_draft ?? row.counter_outcome ?? "unset";
  const outcome = raw === "picked_up" ? "picked_up" : "unset";
  return { outcome, cancelReason: null, cancelDetail: null };
}

/** Plafond technique saisie stock pour les lignes proposées par l’officine (pas de lien avec la « quantité demandée » initiale). */
const PHARMACIST_PROPOSED_STOCK_CEILING = 9999;

/** Après validation dossier : quantité validée / stock saisissable sur les lignes retenues (hors « récupéré »). */
const PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX = 999;

function validatedLineReferenceQty(row: ItemRow): number {
  return Math.min(
    PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
    Math.max(1, Math.floor(Number(row.selected_qty ?? row.requested_qty) || 1))
  );
}

function inferRequestedQtyForAvailability(row: ItemRow): number {
  return row.patient_chosen_alternative_id ? validatedLineReferenceQty(row) : row.requested_qty;
}

/** Disponibilité effective pour réservé / commandé / pastilles (alignée RPC `pharmacist_set_post_confirm_fulfillment` : branche alternative si choisie). */
function effectiveAvailSupplyDraft(
  row: ItemRow,
  f: ItemDraft,
  requestType?: string,
  requestStatus?: string | null
): string | null {
  const isAjoutOfficine =
    requestType != null && isProductRequestAjoutOfficineLine(requestType, row);
  const isOrdonnancePharma =
    requestType != null && isPrescriptionOrdonnancePharmacistLine(requestType, row);
  const isProposedLine = isAjoutOfficine;
  const chosenId = row.patient_chosen_alternative_id ?? null;
  const chosenAlt = chosenId ? normalizeAlts(row.request_item_alternatives).find((a) => a.id === chosenId) : undefined;
  const rq = isOrdonnancePharma ? ordonnanceDraftRequestedQty(row, f) : inferRequestedQtyForAvailability(row);

  let status = f.availability_status;
  let availQty = Number(f.available_qty || "0");

  if (chosenAlt && f.availability_status !== "to_order") {
    const altSt = chosenAlt.availability_status ?? "";
    if (altSt === "partially_available" || altSt === "available" || altSt === "to_order") {
      const altNorm = altSt === "partially_available" ? "available" : altSt;
      const mainSt = row.availability_status ?? "";
      const draftActivelyEdited = f.availability_status !== mainSt;
      /** Brouillon encore sur la ligne principale alors que le patient a validé l’alternative. */
      const postConfirmSupply =
        requestStatus != null &&
        ["confirmed", "treated"].includes(requestStatus) &&
        Boolean(row.is_selected_by_patient);
      const staleMainDraft =
        !draftActivelyEdited &&
        (postConfirmSupply ||
          status === mainSt ||
          Boolean(mainSt && ["unavailable", "market_shortage"].includes(String(mainSt))));
      if (staleMainDraft) {
        status = altNorm;
        const aq = Number(chosenAlt.available_qty ?? 0);
        availQty = Number.isFinite(aq) ? aq : availQty;
      }
    }
  }

  return inferAvailabilityStatusFromQty({
    status,
    availableQty: availQty,
    requestedQty: rq,
    isProposedLine,
  });
}

function effectiveEtaSupplyDraft(
  row: ItemRow,
  f: ItemDraft,
  requestType?: string,
  requestStatus?: string | null
): string | null {
  if (
    pharmacistSupplyDraftNeedsReceptionDate({
      draftStatus: f.availability_status,
      inferredEffectiveStatus: effectiveAvailSupplyDraft(row, f, requestType, requestStatus),
    })
  ) {
    const d = f.expected_availability_date?.trim();
    return d && d.length > 0 ? d : null;
  }
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) {
    const alts = normalizeAlts(row.request_item_alternatives);
    const a = alts.find((x) => x.id === chosen);
    if (
      pharmacistSupplyDraftNeedsReceptionDate({
        draftStatus: f.availability_status,
        inferredEffectiveStatus: effectiveAvailSupplyDraft(row, f, requestType, requestStatus),
      })
    ) {
      const d = f.expected_availability_date?.trim();
      if (d) return d;
      return a?.expected_availability_date?.trim() || row.expected_availability_date?.trim() || null;
    }
    return null;
  }
  return null;
}

function buildItemUpdatePayload(f: ItemDraft, row: ItemRow, requestType?: string) {
  const availQty = Number(f.available_qty);
  const isAjoutOfficine =
    requestType != null && isProductRequestAjoutOfficineLine(requestType, row);
  const isOrdonnancePharma =
    requestType != null && isPrescriptionOrdonnancePharmacistLine(requestType, row);
  if (Number.isNaN(availQty) || availQty < 0) {
    throw new Error("Quantité disponible invalide sur une ligne.");
  }
  if (isAjoutOfficine && availQty < 1) {
    throw new Error("Pour une proposition officine, la dispo doit être au moins 1.");
  }
  const requestedQty = isOrdonnancePharma
    ? ordonnanceDraftRequestedQty(row, f)
    : inferRequestedQtyForAvailability(row);
  const applyOrdonnancePrescribedAvailCap =
    isOrdonnancePharma &&
    !Boolean(f.withdrawn_after_confirm) &&
    !row.patient_chosen_alternative_id;
  if (applyOrdonnancePrescribedAvailCap && availQty > requestedQty) {
    throw new Error("La quantité disponible ne peut pas dépasser la quantité prescrite.");
  }
  const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
  if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
    throw new Error("Prix unitaire invalide.");
  }
  const inferred = inferAvailabilityStatusFromQty({
    status: f.availability_status,
    availableQty: availQty,
    requestedQty,
    isProposedLine: isAjoutOfficine,
  });
  if (inferred === "to_order" && f.expected_availability_date.trim() !== "") {
    assertReceptionDateNotBeforeToday(f.expected_availability_date, one(row.products)?.name ?? undefined);
  }
  return {
    availability_status: inferred,
    available_qty: availQty,
    unit_price: price,
    pharmacist_comment: f.pharmacist_comment.trim() || null,
    expected_availability_date:
      inferred === "to_order" && f.expected_availability_date.trim() !== ""
        ? f.expected_availability_date
        : null,
  };
}

/** Plafond saisie patient / ligne « réponse » classique (hors stock proposition officine, voir `PHARMACIST_PROPOSED_STOCK_CEILING`). */
function clampRequestItemQty(n: number): number {
  return Math.min(10, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));
}

function catalogPriceMadLabel(
  config: PharmacyPricingConfig | null | undefined,
  prod: ProdEmbedDb | null | undefined,
  productId?: string,
  unitPrice?: number | string | null
): string {
  if (unitPrice != null && unitPrice !== "" && !Number.isNaN(Number(unitPrice))) {
    return `${Number(unitPrice).toFixed(2)} MAD`;
  }
  const resolved = resolvePharmacyUnitPrice(
    config,
    productEmbedToPricingInput(
      prod
        ? {
            product_type: prod.product_type ?? "parapharmacie",
            price_pph: prod.price_pph,
            price_ppv: prod.price_ppv,
            brand: prod.brand,
          }
        : null,
      productId
    )
  );
  if (resolved == null) return "—";
  return `${resolved.toFixed(2)} MAD`;
}

function publishConfirmModalGroup(inferred: string): "ready" | "order" | "blocked" {
  if (inferred === "available" || inferred === "partially_available") return "ready";
  if (inferred === "to_order") return "order";
  return "blocked";
}

type PublishConfirmRowMeta = {
  r: ItemRow;
  fd: ItemDraft;
  inferredKey: string;
  availUi: ReturnType<typeof availabilityStatusUi>;
  proposed: boolean;
  ordonnancePrincipal: boolean;
  additionalProposed: boolean;
  prescribedQty: number | null;
  prodName: string;
  priceMad: string;
  note: string;
  eta: string | null;
  alts: AltRowDb[];
};

function buildPublishConfirmRowMeta(
  r: ItemRow,
  fd: ItemDraft,
  requestType?: string | null,
  amendmentBundles: { amendments: unknown }[] = [],
  pricingConfig?: PharmacyPricingConfig | null
): PublishConfirmRowMeta {
  const proposed = isPharmacistProposedRow(r);
  const ordonnancePrincipal =
    requestType === "prescription" &&
    isPrescriptionOrdonnancePrincipalLine(requestType, r, amendmentBundles);
  const additionalProposed =
    requestType === "prescription" &&
    isPrescriptionAdditionalProposedLine(requestType, r, amendmentBundles);
  const requestedQtyForInfer = ordonnancePrincipal
    ? ordonnanceDraftRequestedQty(r, fd)
    : inferRequestedQtyForAvailability(r);
  let inferredKey = fd.availability_status;
  try {
    inferredKey = inferAvailabilityStatusFromQty({
      status: fd.availability_status,
      availableQty: Number(fd.available_qty || "0"),
      requestedQty: requestedQtyForInfer,
      isProposedLine:
        additionalProposed ||
        (requestType === "product_request" && isProductRequestAjoutOfficineLine(requestType, r)) ||
        requestType === "free_consultation",
    });
  } catch {
    inferredKey = fd.availability_status;
  }
  const prescribedQty = ordonnancePrincipal ? requestedQtyForInfer : null;
  const availUi = availabilityStatusUi(inferredKey);
  const prodName = one(r.products)?.name ?? "Produit";
  const priceMad =
    fd.unit_price.trim() !== ""
      ? `${Number(fd.unit_price.replace(",", ".")).toFixed(2)} MAD`
      : catalogPriceMadLabel(pricingConfig, one(r.products), r.product_id);
  const note = fd.pharmacist_comment?.trim() ?? "";
  const eta =
    fd.availability_status === "to_order" && fd.expected_availability_date.trim()
      ? formatDateShortFr(fd.expected_availability_date.trim())
      : null;
  const alts = normalizeAlts(r.request_item_alternatives);
  return {
    r,
    fd,
    inferredKey,
    availUi,
    proposed,
    ordonnancePrincipal,
    additionalProposed,
    prescribedQty,
    prodName,
    priceMad,
    note,
    eta,
    alts,
  };
}

function publishConfirmLineBadge(meta: PublishConfirmRowMeta, fallbackProposed: string, ordonnanceBadge: string) {
  if (meta.ordonnancePrincipal) return { label: ordonnanceBadge, tone: "ordonnance" as const };
  if (meta.additionalProposed) return { label: "Proposé", tone: "officine" as const };
  if (meta.proposed) return { label: fallbackProposed, tone: "officine" as const };
  return { label: fallbackProposed, tone: "officine" as const };
}

function PublishConfirmLineLi({
  meta,
  altQtyDrafts,
  proposedBadgeLabel,
  ordonnanceBadgeLabel,
  pricingConfig,
}: {
  meta: PublishConfirmRowMeta;
  altQtyDrafts: Record<string, string>;
  proposedBadgeLabel: string;
  ordonnanceBadgeLabel: string;
  pricingConfig?: PharmacyPricingConfig | null;
}) {
  const { r, fd, proposed, prodName, priceMad, note, eta, alts, ordonnancePrincipal, prescribedQty } = meta;
  const lineBadge = publishConfirmLineBadge(meta, proposedBadgeLabel, ordonnanceBadgeLabel);
  const ordonnanceTone = proposed && lineBadge.tone === "ordonnance";
  const availableQtyNum = Number(fd.available_qty || "0");
  const dispoQtyLabel = ordonnancePrincipal ? "Prescrit" : "Dispo";
  const dispoQtyValue = ordonnancePrincipal ? (prescribedQty ?? "—") : fd.available_qty || "—";

  return (
    <li
      key={r.id}
      className={clsx(
        "rounded-lg border bg-card px-2.5 py-2 shadow-sm",
        ordonnanceTone
          ? "border-amber-200/70"
          : proposed
            ? "border-violet-200/70"
            : "border-border/70"
      )}
    >
      <p className="text-[12px] font-semibold leading-snug text-foreground">{prodName}</p>
      {proposed ? (
        <div className="mt-1 space-y-0.5">
          <span
            className={clsx(
              "inline-flex rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white",
              ordonnanceTone ? "bg-amber-700" : "bg-violet-600"
            )}
          >
            {lineBadge.label}
          </span>
          {r.pharmacist_proposal_reason?.trim() ? (
            <p
              className={clsx(
                "text-[10px] leading-snug",
                ordonnanceTone ? "text-amber-900/90" : "text-violet-900/90"
              )}
            >
              <span className="font-semibold">Motif · </span>
              <span className="italic">{r.pharmacist_proposal_reason.trim()}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
          Qté patient{" "}
          <span className="font-semibold tabular-nums text-foreground">{r.requested_qty}</span>
        </p>
      )}
      <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0 text-[10px] leading-none text-muted-foreground">
        <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap">
          <span className="font-medium">{dispoQtyLabel}</span>
          <span className="font-semibold tabular-nums text-foreground">{dispoQtyValue}</span>
        </span>
        {ordonnancePrincipal ? (
          <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap">
            <span className="font-medium">Dispo</span>
            <span className="font-semibold tabular-nums text-foreground">
              {Number.isFinite(availableQtyNum) ? availableQtyNum : "—"}
            </span>
          </span>
        ) : null}
        <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap">
          <span className="font-medium">Prix</span>
          <span className="font-semibold tabular-nums text-foreground">{priceMad}</span>
        </span>
        {eta ? (
          <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap text-teal-900">
            <span className="font-medium">Réception</span>
            <span className="font-semibold tabular-nums">{eta}</span>
          </span>
        ) : null}
      </p>
      {note ? (
        <p className="mt-2 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-[10px] leading-snug text-foreground">
          <span className="font-semibold">Note · </span>
          {note}
        </p>
      ) : null}
      {alts.length > 0 ? (
        <div className="mt-2 border-t border-border/50 pt-2">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
            Alternatives ({alts.length})
          </p>
          <ul className="mt-1 space-y-1">
            {alts.map((alt) => {
              const an = one(alt.products)?.name ?? "Alternative";
              const aq = isLocalAltId(alt.id)
                ? clampAlternativeAvailableQty(Number(alt.available_qty ?? 1))
                : clampAlternativeAvailableQty(Number(altQtyDrafts[alt.id] ?? alt.available_qty ?? r.requested_qty));
              const aeta =
                alt.availability_status === "to_order" && alt.expected_availability_date?.trim()
                  ? formatDateShortFr(alt.expected_availability_date.trim())
                  : null;
              const ap = catalogPriceMadLabel(
                pricingConfig,
                one(alt.products),
                alt.product_id,
                alt.unit_price
              );
              return (
                <li
                  key={alt.id}
                  className="rounded-md border border-border/60 bg-muted/15 px-2 py-1 text-[10px] text-foreground"
                >
                  <span className="font-semibold">{an}</span>
                  <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 whitespace-nowrap text-muted-foreground">
                    <span>
                      Dispo <strong className="text-foreground">{aq}</strong>
                    </span>
                    <span>
                      Prix <strong className="text-foreground">{ap}</strong>
                    </span>
                    {aeta ? (
                      <span>
                        Réception <strong className="text-foreground">{aeta}</strong>
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

function isPharmacistProposedRow(row: ItemRow): boolean {
  return row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
}

function withSyncedPostConfirmQtyDraft(
  row: ItemRow,
  requestStatus: string | null | undefined,
  entry: ItemDraft
): ItemDraft {
  if (!requestStatus || !["confirmed", "treated"].includes(requestStatus)) return entry;
  if (!row.is_selected_by_patient) return entry;
  const q = entry.available_qty?.trim();
  if (!q) return entry;
  return { ...entry, selected_qty_str: q };
}

/** Ligne proposée par l’officine retenue par le patient : la qté validée est `selected_qty`, pas l’offre `available_qty`. */
function postConfirmValidatedQtyBase(row: ItemRow): number {
  return Math.min(
    PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
    Math.max(1, Math.floor(Number(row.selected_qty ?? row.requested_qty) || 1))
  );
}

/** Qté validée à persister (ligne retenue post-validation) : une seule source pour `selected_qty` et `available_qty`. */
function draftValidatedQtyForSave(f: ItemDraft, row: ItemRow): number {
  const fromSelStr = Number(f.selected_qty_str);
  const fromAvail = Number(f.available_qty);
  const persistedSel = postConfirmValidatedQtyBase(row);

  if (isPharmacistProposedRow(row) && row.is_selected_by_patient) {
    if (Number.isFinite(fromSelStr) && fromSelStr >= 1) {
      return Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, Math.floor(fromSelStr));
    }
    return persistedSel;
  }

  let n = persistedSel;
  if (Number.isFinite(fromAvail) && fromAvail >= 1) n = Math.floor(fromAvail);
  else if (Number.isFinite(fromSelStr) && fromSelStr >= 1) n = Math.floor(fromSelStr);
  return Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, Math.max(1, n));
}

/** Mise à jour ligne : payload dispo/prix + pour ajout officine produit, `requested_qty` / `selected_qty` = qté offerte. */
function buildRequestItemUpdatePayloadForPharmacistSave(
  f: ItemDraft,
  row: ItemRow,
  requestType: string,
  requestStatus?: string | null
) {
  const base = buildItemUpdatePayload(f, row, requestType);
  let payload: ReturnType<typeof buildItemUpdatePayload> & {
    requested_qty?: number;
    selected_qty?: number;
  };
  if (isPrescriptionOrdonnancePharmacistLine(requestType, row)) {
    const req = ordonnanceDraftRequestedQty(row, f);
    payload = {
      ...base,
      requested_qty: req,
      selected_qty: req,
    };
  } else if (!isPharmacistProposedRow(row) || !isProductRequestAjoutOfficineLine(requestType, row)) {
    payload = base;
  } else {
    const n = clampRequestItemQty(Number(f.available_qty));
    payload = {
      ...base,
      requested_qty: n,
      selected_qty: n,
    };
  }
  if (
    requestStatus &&
    ["confirmed", "treated", "completed", "partially_collected", "fully_collected", "cancelled", "abandoned", "expired"].includes(
      requestStatus
    )
  ) {
    return {
      ...payload,
      pharmacist_comment: row.pharmacist_comment ?? null,
    };
  }
  return payload;
}

function buildPharmaConfirmAdjustmentAudit(items: ItemRow[], draft: Draft): PharmaConfirmAdjustmentAudit | null {
  const lines: PharmaConfirmAdjustmentLine[] = [];
  for (const row of items) {
    const f = draft[row.id];
    if (!f) continue;
    const newQtyNum = Number(f.available_qty);
    const oldQty = row.available_qty;
    const newAvail = f.availability_status;
    const oldAvail = row.availability_status ?? null;
    if (oldQty === newQtyNum && oldAvail === newAvail) continue;
    const validatedQty = Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));
    lines.push({
      productName: validatedProductLabel(row as PatientLineLike),
      validatedQty,
      oldAvailQty: oldQty,
      newAvailQty: Number.isFinite(newQtyNum) ? newQtyNum : oldQty ?? 0,
      oldAvailabilityStatus: oldAvail,
      newAvailabilityStatus: newAvail,
      oldAvailLabelFr: oldAvail ? availabilityStatusFr[oldAvail] ?? oldAvail : null,
      newAvailLabelFr: availabilityStatusFr[newAvail] ?? newAvail,
    });
  }
  if (lines.length === 0) return null;
  return { v: 1, kind: "pharma_adjust_confirmed", lines };
}

/** État du formulaire officine depuis une ligne base (chargement ou nouvelle ligne). */
function buildItemDraftFromRow(row: ItemRow, requestStatus?: string | null, requestType?: string): ItemDraft {
  const catalogPph = one(row.products)?.price_pph;
  const isProp = row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
  const isAjoutOfficine = requestType === "product_request" && isProp;
  const isOrdonnancePharma =
    requestType === "prescription" &&
    isPrescriptionOrdonnancePrincipalLine(requestType, row, []);
  const isPrescriptionExtraProposed =
    requestType === "prescription" &&
    isProp &&
    !isOrdonnancePharma;
  const postConfirmSupply =
    requestStatus != null && ["confirmed", "treated"].includes(requestStatus) && row.is_selected_by_patient;
  const chosenId = row.patient_chosen_alternative_id ?? null;
  const chosenAlt = chosenId ? normalizeAlts(row.request_item_alternatives).find((a) => a.id === chosenId) : undefined;
  const useChosenBranchForDraft = Boolean(postConfirmSupply && chosenAlt);

  /* `partially_available` est dérivé automatiquement (qté < demandée). On affiche le brouillon en `available` :
     il sera réinféré au save si la quantité reste < demandée. */
  const rawStatus = useChosenBranchForDraft
    ? (chosenAlt!.availability_status ?? "available")
    : (row.availability_status ?? "available");
  const draftStatus = rawStatus === "partially_available" ? "available" : rawStatus;
  const reqCap = Math.max(0, Math.floor(Number(row.requested_qty)) || 0);
  const selCap = postConfirmSupply && !isProp ? PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX : 10;
  const selBase = Math.min(selCap, Math.max(1, Number(row.selected_qty ?? row.requested_qty) || 1));

  let availNum: number;
  if (useChosenBranchForDraft) {
    const cap = PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX;
    let fromAlt = selBase;
    if (!Number.isFinite(fromAlt)) fromAlt = 1;
    availNum = Math.max(0, Math.min(cap, Math.floor(fromAlt)));
  } else {
    const rowAvailStatus = row.availability_status ?? "available";
    if (
      isOrdonnancePharma &&
      (rowAvailStatus === "market_shortage" || rowAvailStatus === "unavailable")
    ) {
      availNum = row.available_qty != null ? Number(row.available_qty) : 0;
    } else if (postConfirmSupply && (!isProp || row.is_selected_by_patient)) {
      availNum = postConfirmValidatedQtyBase(row);
    } else {
      availNum = row.available_qty != null ? Number(row.available_qty) : Number(row.requested_qty);
    }
    if (!Number.isFinite(availNum)) availNum = isOrdonnancePharma ? 0 : reqCap;
    if (isAjoutOfficine || isPrescriptionExtraProposed) {
      availNum = Math.max(1, Math.floor(availNum));
    } else {
      const availCap = postConfirmSupply ? PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX : reqCap;
      availNum = Math.max(0, Math.min(availCap, Math.floor(availNum)));
    }
  }

  const unitPriceStr = useChosenBranchForDraft
    ? chosenAlt!.unit_price != null
      ? String(chosenAlt!.unit_price)
      : row.unit_price != null
        ? String(row.unit_price)
        : catalogPph != null
          ? String(catalogPph)
          : ""
    : row.unit_price != null
      ? String(row.unit_price)
      : catalogPph != null
        ? String(catalogPph)
        : "";

  const expectedDateStr = useChosenBranchForDraft
    ? chosenAlt!.expected_availability_date ?? row.expected_availability_date ?? ""
    : row.expected_availability_date ?? "";

  const pharmacistCommentStr = useChosenBranchForDraft
    ? chosenAlt!.pharmacist_comment ?? row.pharmacist_comment ?? ""
    : row.pharmacist_comment ?? "";

  return {
    availability_status: draftStatus,
    available_qty: String(availNum),
    requested_qty_str: isOrdonnancePharma ? String(row.requested_qty) : undefined,
    unit_price: unitPriceStr,
    pharmacist_comment: pharmacistCommentStr,
    expected_availability_date: expectedDateStr,
    withdrawn_after_confirm: Boolean(row.withdrawn_after_confirm),
    selected_qty_str: String(selBase),
    fulfillment_draft: fulfillmentDraftFromRow(row),
    counter_outcome_draft: row.counter_outcome ?? "unset",
    counter_cancel_reason_draft: row.counter_cancel_reason ?? null,
    counter_cancel_detail_draft: row.counter_cancel_detail ?? null,
  };
}

/**
 * Fusion brouillon après reload : conserve les saisies en cours, sauf disponibilité
 * de l’alternative retenue (sinon l’ancien brouillon « réponse » masque Réservé / Commandé).
 */
function mergeItemDraftOnReload(
  row: ItemRow,
  built: ItemDraft,
  prev: ItemDraft | undefined,
  requestStatus: string | null | undefined
): ItemDraft {
  if (!prev) return built;
  const postConfirmChosenAlt =
    Boolean(row.patient_chosen_alternative_id) &&
    Boolean(row.is_selected_by_patient) &&
    requestStatus != null &&
    ["confirmed", "treated"].includes(requestStatus);
  const supplyFromBuilt = postConfirmChosenAlt
    ? {
        availability_status: built.availability_status,
        available_qty: built.available_qty,
        unit_price: built.unit_price,
        expected_availability_date: built.expected_availability_date,
        pharmacist_comment: built.pharmacist_comment,
      }
    : {};
  if (requestStatus != null && ["confirmed", "treated"].includes(requestStatus)) {
    const supplyFields = postConfirmChosenAlt
      ? {
          available_qty: supplyFromBuilt.available_qty ?? built.available_qty,
          availability_status: supplyFromBuilt.availability_status ?? built.availability_status,
          unit_price: supplyFromBuilt.unit_price ?? built.unit_price,
          expected_availability_date:
            supplyFromBuilt.expected_availability_date ?? built.expected_availability_date,
          pharmacist_comment: supplyFromBuilt.pharmacist_comment ?? built.pharmacist_comment,
        }
      : {
          available_qty: prev.available_qty ?? built.available_qty,
          availability_status: prev.availability_status ?? built.availability_status,
          unit_price: prev.unit_price ?? built.unit_price,
          expected_availability_date: prev.expected_availability_date ?? built.expected_availability_date,
          pharmacist_comment: prev.pharmacist_comment ?? built.pharmacist_comment,
        };
    return {
      ...built,
      ...prev,
      ...supplyFromBuilt,
      withdrawn_after_confirm: built.withdrawn_after_confirm,
      fulfillment_draft: prev.fulfillment_draft ?? built.fulfillment_draft,
      counter_outcome_draft: prev.counter_outcome_draft ?? built.counter_outcome_draft,
      counter_cancel_reason_draft: prev.counter_cancel_reason_draft ?? built.counter_cancel_reason_draft,
      counter_cancel_detail_draft: prev.counter_cancel_detail_draft ?? built.counter_cancel_detail_draft,
      selected_qty_str: prev.selected_qty_str ?? built.selected_qty_str,
      ...supplyFields,
    };
  }
  return {
    ...built,
    ...prev,
    ...supplyFromBuilt,
    withdrawn_after_confirm: built.withdrawn_after_confirm,
    selected_qty_str: built.selected_qty_str,
    fulfillment_draft: built.fulfillment_draft,
  };
}

/**
 * Après flush des propositions locales : réassocie le brouillon aux `request_items` persistés.
 * Conserve les saisies en cours (y compris lignes avec alternative retenue) — ne pas réappliquer
 * `mergeItemDraftOnReload` qui réinjecte la dispo persistée et efface les autres modifications simultanées.
 */
function mergeDraftAfterLocalProposalFlush(
  freshItems: ItemRow[],
  prevDraft: Draft,
  localToServer: Map<string, string>,
  requestStatus: string | null
): Draft {
  const serverToLocal = new Map(Array.from(localToServer, ([loc, srv]) => [srv, loc]));
  const next: Draft = {};
  for (const row of freshItems) {
    const localId = serverToLocal.get(row.id);
    const prev = localId ? prevDraft[localId] : prevDraft[row.id];
    const built = buildItemDraftFromRow(row, requestStatus);
    if (!prev) {
      next[row.id] = built;
      continue;
    }
    next[row.id] = {
      ...built,
      ...prev,
      withdrawn_after_confirm: prev.withdrawn_after_confirm,
      availability_status: prev.availability_status,
      available_qty: prev.available_qty,
      unit_price: prev.unit_price,
      pharmacist_comment: prev.pharmacist_comment,
      expected_availability_date: prev.expected_availability_date,
      selected_qty_str: prev.selected_qty_str,
      fulfillment_draft: prev.fulfillment_draft ?? built.fulfillment_draft,
      counter_outcome_draft: prev.counter_outcome_draft ?? built.counter_outcome_draft,
      counter_cancel_reason_draft: prev.counter_cancel_reason_draft ?? built.counter_cancel_reason_draft,
      counter_cancel_detail_draft: prev.counter_cancel_detail_draft ?? built.counter_cancel_detail_draft,
    };
  }
  return next;
}

/** Amendements « ajout après validation » pour un lot unique (après insert, avant journal global). */
function buildLineAddedAmendmentsFromProposalFlush(
  proposalSnap: ItemRow[],
  workItems: ItemRow[],
  idMap: Map<string, string>,
  requestType: string,
  channel: string,
  motive: string
): SupplyAmendmentEntryJson[] {
  const out: SupplyAmendmentEntryJson[] = [];
  for (const localRow of proposalSnap) {
    const serverId = idMap.get(localRow.id);
    if (!serverId) continue;
    const persisted = workItems.find((r) => r.id === serverId);
    if (!persisted) continue;
    const nm = validatedProductLabel(persisted as PatientLineLike);
    const qty = Math.max(
      1,
      Math.floor(Number(persisted.selected_qty ?? persisted.available_qty ?? persisted.requested_qty) || 1)
    );
    const mode: "ordonnance" | "proposed" =
      requestType === "prescription" && localRow.line_source === "patient_request" ? "ordonnance" : "proposed";
    out.push(
      buildLineAddedAfterConfirmAmendment({
        requestItemId: serverId,
        productName: nm,
        qty,
        mode,
        channel,
        motive,
      })
    );
  }
  return out;
}

function normalizeDraftAvailabilityForCompare(status: string | null | undefined): string {
  if (status === "partially_available") return "available";
  return status ?? "available";
}

function computeSupplyStructuralDirty(
  request: { status: string; request_type: string } | null,
  items: ItemRow[],
  draft: Draft,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  altQtyDrafts: Record<string, string>,
  removedPersistedProposedIds: string[] = [],
  pendingDeletedAlternativeIds: string[] = []
): boolean {
  if (!request || !["confirmed", "treated"].includes(request.status)) return false;
  if (pendingProposalRows.length > 0) return true;
  if (pendingAlternatives.length > 0) return true;
  if (removedPersistedProposedIds.length > 0) return true;
  if (pendingDeletedAlternativeIds.length > 0) return true;
  for (const row of items) {
    if (!row.is_selected_by_patient) continue;
    const d = draft[row.id];
    if (!d) continue;
    const b = buildItemDraftFromRow(row, request?.status ?? null, request?.request_type);
    if (d.withdrawn_after_confirm !== b.withdrawn_after_confirm) return true;
    if (
      normalizeDraftAvailabilityForCompare(d.availability_status) !==
      normalizeDraftAvailabilityForCompare(b.availability_status)
    )
      return true;
    if (d.available_qty !== b.available_qty) return true;
    if (d.unit_price !== b.unit_price) return true;
    if (d.pharmacist_comment !== b.pharmacist_comment) return true;
    if (d.expected_availability_date !== b.expected_availability_date) return true;
    if (d.selected_qty_str !== b.selected_qty_str) return true;
    /* Réservé / commandé / reçu : enregistrement immédiat (RPC), pas la barre du bas. */
  }

  for (const row of items) {
    const alts = normalizeAlts(row.request_item_alternatives);
    for (const alt of alts) {
      if (pendingDeletedAlternativeIds.includes(alt.id)) continue;
      if (isLocalAltId(alt.id)) return true;
      const draftQty = altQtyDrafts[alt.id];
      if (draftQty === undefined) continue;
      const persisted = String(alt.available_qty ?? row.requested_qty);
      if (String(draftQty).trim() !== persisted) return true;
    }
  }

  return false;
}

type RespondedEditSnapshot = {
  draft: Draft;
  altQtyDrafts: Record<string, string>;
  pendingProposalIds: string;
  pendingAlternativesJson: string;
  pendingDeletedAlternativeIdsJson: string;
  removedPersistedLineIdsJson: string;
};

function takeRespondedEditSnapshot(
  draft: Draft,
  altQtyDrafts: Record<string, string>,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  pendingDeletedAlternativeIds: string[],
  removedPersistedRespondedEditIds: string[]
): RespondedEditSnapshot {
  return {
    draft: JSON.parse(JSON.stringify(draft)) as Draft,
    altQtyDrafts: { ...altQtyDrafts },
    pendingProposalIds: pendingProposalRows.map((r) => r.id).join(","),
    pendingAlternativesJson: JSON.stringify(pendingAlternatives),
    pendingDeletedAlternativeIdsJson: JSON.stringify(pendingDeletedAlternativeIds),
    removedPersistedLineIdsJson: JSON.stringify(removedPersistedRespondedEditIds),
  };
}

function diffRespondedSnapshots(
  baseline: RespondedEditSnapshot,
  displayRows: ItemRow[],
  draft: Draft,
  altQtyDrafts: Record<string, string>,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  pendingDeletedAlternativeIds: string[],
  removedPersistedRespondedEditIds: string[]
): string[] {
  const lines: string[] = [];
  const pendIds = pendingProposalRows.map((r) => r.id).join(",");
  if (baseline.pendingProposalIds !== pendIds) {
    lines.push("Propositions officine (ajout ou retrait avant enregistrement)");
  }
  const pendAlt = JSON.stringify(pendingAlternatives);
  if (baseline.pendingAlternativesJson !== pendAlt) {
    lines.push("Alternatives encore en brouillon (hors enregistrement précédent)");
  }
  const pendDelAlt = JSON.stringify(pendingDeletedAlternativeIds);
  if (baseline.pendingDeletedAlternativeIdsJson !== pendDelAlt && pendingDeletedAlternativeIds.length > 0) {
    lines.push("Retrait d'une ou plusieurs alternatives");
  }
  const removedJson = JSON.stringify(removedPersistedRespondedEditIds);
  if (baseline.removedPersistedLineIdsJson !== removedJson && removedPersistedRespondedEditIds.length > 0) {
    lines.push("Retrait d'une ou plusieurs lignes produit");
  }
  const altKeys = new Set([...Object.keys(baseline.altQtyDrafts), ...Object.keys(altQtyDrafts)]);
  for (const k of altKeys) {
    if ((baseline.altQtyDrafts[k] ?? "") !== (altQtyDrafts[k] ?? "")) {
      lines.push("Quantités sur une ou plusieurs alternatives");
      break;
    }
  }
  for (const row of displayRows) {
    if (isLocalProposedItemId(row.id)) continue;
    const a = baseline.draft[row.id];
    const b = draft[row.id];
    if (!a || !b) continue;
    const bits: string[] = [];
    const nm = validatedProductLabel(row as PatientLineLike);
    if (a.availability_status !== b.availability_status) bits.push("disponibilité");
    if (a.available_qty !== b.available_qty) bits.push("dispo");
    if (a.pharmacist_comment !== b.pharmacist_comment) bits.push("message / note de ligne");
    if (a.expected_availability_date !== b.expected_availability_date) bits.push("date prévue");
    if (a.selected_qty_str !== b.selected_qty_str) bits.push("quantité validée (patient)");
    if (bits.length) lines.push(`${nm} — ${bits.join(", ")}`);
  }
  return lines;
}

function unitPricesEqualForSupplyAmend(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) < 0.0001;
}

/** Champs stock / dispo persistés : branche alternative retenue si le patient l’a choisie. */
function supplyRowPersistedSupplyFields(row: ItemRow) {
  const chosenId = row.patient_chosen_alternative_id ?? null;
  if (chosenId) {
    const chosen = normalizeAlts(row.request_item_alternatives).find((a) => a.id === chosenId);
    if (chosen) {
      return {
        available_qty: chosen.available_qty != null ? Number(chosen.available_qty) : null,
        availability_status: chosen.availability_status ?? null,
        unit_price: chosen.unit_price ?? row.unit_price ?? null,
        pharmacist_comment: chosen.pharmacist_comment ?? null,
        expected_availability_date: chosen.expected_availability_date ?? null,
      };
    }
  }
  return {
    available_qty: row.available_qty != null ? Number(row.available_qty) : null,
    availability_status: row.availability_status ?? null,
    unit_price: row.unit_price ?? null,
    pharmacist_comment: row.pharmacist_comment ?? null,
    expected_availability_date: row.expected_availability_date ?? null,
  };
}

function mergeChosenAltQtyDraftsIntoWorkDraft(
  rows: ItemRow[],
  workDraft: Draft,
  altQtyDrafts: Record<string, string>
): Draft {
  const next = { ...workDraft };
  for (const row of rows) {
    const chosenId = row.patient_chosen_alternative_id;
    if (!chosenId || !row.is_selected_by_patient) continue;
    const raw = altQtyDrafts[chosenId];
    if (raw === undefined) continue;
    const trimmed = String(raw).trim();
    if (trimmed === "") continue;
    const f = next[row.id];
    if (!f) continue;
    next[row.id] = { ...f, available_qty: trimmed, selected_qty_str: trimmed };
  }
  return next;
}

function buildSupplyStructuralAmends(
  items: ItemRow[],
  draft: Draft,
  requestType: string
): SupplyAmendmentEntryJson[] {
  const out: SupplyAmendmentEntryJson[] = [];
  for (const row of items) {
    const f = draft[row.id];
    if (!f) continue;
    const nm = validatedProductLabel(row as PatientLineLike);
    if (Boolean(f.withdrawn_after_confirm)) {
      continue;
    }
    let payload: ReturnType<typeof buildItemUpdatePayload>;
    try {
      payload = buildItemUpdatePayload(f, row, requestType);
    } catch {
      continue;
    }
    const persisted = supplyRowPersistedSupplyFields(row);
    const persistedSelected = postConfirmValidatedQtyBase(row);
    const draftSelected = draftValidatedQtyForSave(f, row);
    const persistedQtyForAmend =
      isPharmacistProposedRow(row) && row.is_selected_by_patient
        ? persistedSelected
        : persisted.available_qty;
    const qtyChanged = persistedQtyForAmend !== (payload.available_qty ?? null);
    const selectedQtyChanged =
      row.is_selected_by_patient && !f.withdrawn_after_confirm && persistedSelected !== draftSelected;
    const avChanged =
      normalizeDraftAvailabilityForCompare(persisted.availability_status) !==
      normalizeDraftAvailabilityForCompare(payload.availability_status ?? null);
    const priceChanged = !unitPricesEqualForSupplyAmend(persisted.unit_price, payload.unit_price);
    const ccRow = (persisted.pharmacist_comment ?? "").trim();
    const ccNew = (payload.pharmacist_comment ?? "").trim();
    const ccChanged = ccRow !== ccNew;
    const dRow = (persisted.expected_availability_date ?? "").trim();
    const dNew = (payload.expected_availability_date ?? "").trim().slice(0, 10);
    const dateChanged = dRow !== dNew;
    if (qtyChanged || selectedQtyChanged || avChanged || priceChanged || ccChanged || dateChanged) {
      const bits: string[] = [];
      if (avChanged) {
        bits.push(
          `disponibilité « ${availabilityStatusFr[persisted.availability_status ?? ""] ?? persisted.availability_status ?? "—"} » → « ${availabilityStatusFr[payload.availability_status] ?? payload.availability_status} »`
        );
      }
      if (selectedQtyChanged) {
        bits.push(`quantité validée ${persistedSelected} → ${draftSelected}`);
      } else if (qtyChanged) {
        bits.push(`quantité officine ${persisted.available_qty ?? "—"} → ${payload.available_qty}`);
      }
      if (priceChanged) bits.push("prix unitaire");
      if (dateChanged) bits.push("date de disponibilité");
      if (ccChanged) bits.push("commentaire officine");
      out.push({
        kind: selectedQtyChanged ? "validated_qty_change" : "line_adjust_supply",
        request_item_id: row.id,
        summary: `${nm} — ${bits.join(", ")}`,
        detail: bits.join(" · "),
      });
    }
  }
  return out;
}

/** True si un journal patient (canal obligatoire) sera enregistré à la confirmation. */
function confirmedSupplySaveNeedsPatientChannel(
  rows: ItemRow[],
  d: Draft,
  requestType: string,
  proposalSnapLocal: ItemRow[],
  removedIds: string[]
): boolean {
  if (proposalSnapLocal.length > 0) return true;
  if (removedIds.length > 0) return true;
  if (buildSupplyStructuralAmends(rows, d, requestType).length > 0) return true;
  for (const row of rows) {
    const fd = d[row.id];
    if (!fd || !row.is_selected_by_patient) continue;
    if (!row.withdrawn_after_confirm && Boolean(fd.withdrawn_after_confirm)) return true;
  }
  return false;
}

function assertSupplyAmendmentChannels(amends: SupplyAmendmentEntryJson[]): void {
  for (let i = 0; i < amends.length; i++) {
    if ((amends[i].client_confirmation_channel ?? "").trim().length < 2) {
      throw new Error(
        `Canal d’accord patient requis pour le journal des modifications (entrée ${i + 1}). Choisissez un canal dans la fenêtre de confirmation.`
      );
    }
  }
}

function buildConfirmedSupplyAmendmentBatch(
  rows: ItemRow[],
  d: Draft,
  requestType: string,
  globalChannel: string,
  globalMotive: string,
  removedIds: string[]
): SupplyAmendmentEntryJson[] {
  const ch = globalChannel.trim();
  const motive = globalMotive.trim();
  const structural = buildSupplyStructuralAmends(rows, d, requestType).map((a) => ({
    ...a,
    client_confirmation_channel: ch,
    client_motive: motive === "" ? null : motive,
  }));

  const withdrawAmends: SupplyAmendmentEntryJson[] = [];
  for (const row of rows) {
    const f = d[row.id];
    if (!f || !row.is_selected_by_patient) continue;
    const was = Boolean(row.withdrawn_after_confirm);
    const next = Boolean(f.withdrawn_after_confirm);
    if (was === next) continue;
    if (was && !next) {
      throw new Error(
        `« ${validatedProductLabel(row as PatientLineLike)} » : la réintégration d’une ligne déjà retirée n’est plus disponible depuis cet écran.`
      );
    }
    const nm = validatedProductLabel(row as PatientLineLike);
    withdrawAmends.push({
      kind: "withdraw_after_confirm",
      request_item_id: row.id,
      summary: `${nm} retiré avec accord patient`,
      detail: `${nm} : ligne retirée après validation.`,
      client_confirmation_channel: ch,
      client_motive: motive === "" ? null : motive,
    });
  }

  const removeProposedAmends: SupplyAmendmentEntryJson[] = [];
  for (const rowId of removedIds) {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.line_source !== "pharmacist_proposed") continue;
    const nm = validatedProductLabel(row as PatientLineLike);
    removeProposedAmends.push({
      kind: "line_removed_after_confirm",
      request_item_id: row.id,
      summary: `${nm} retiré après validation (proposition officine)`,
      detail: `${nm} : proposition officine retirée du dossier validé.`,
      client_confirmation_channel: ch,
      client_motive: motive === "" ? null : motive,
    });
  }

  return [...structural, ...withdrawAmends, ...removeProposedAmends];
}

function buildConfirmedSupplySaveSummaryLines(
  items: ItemRow[],
  draft: Draft,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  altQtyDrafts: Record<string, string>,
  requestStatus: string | null,
  requestType: string,
  pharmacistProposedBadge: string,
  removedPersistedProposedIds: string[] = [],
  pendingDeletedAlternativeIds: string[] = []
): string[] {
  const lines: string[] = [];

  for (const row of pendingProposalRows) {
    const nm = validatedProductLabel(row as PatientLineLike);
    lines.push(`${pharmacistProposedBadge} à créer : « ${nm} » (${row.requested_qty ?? 1} unité(s)).`);
  }

  for (const pe of pendingAlternatives) {
    const parent = items.find((i) => i.id === pe.parentItemId) ?? null;
    const pnm = parent ? validatedProductLabel(parent as PatientLineLike) : "ligne";
    const anm = one(pe.products)?.name ?? "Alternative";
    lines.push(`Nouvelle alternative à enregistrer sur « ${pnm} » : « ${anm} ».`);
  }

  for (const rid of removedPersistedProposedIds) {
    const r = items.find((i) => i.id === rid);
    const nm = r ? validatedProductLabel(r as PatientLineLike) : "Proposition";
    lines.push(`Retrait proposition officine : « ${nm} ».`);
  }

  for (const altId of pendingDeletedAlternativeIds) {
    for (const row of items) {
      const alt = normalizeAlts(row.request_item_alternatives).find((a) => a.id === altId);
      if (!alt) continue;
      const pnm = validatedProductLabel(row as PatientLineLike);
      const anm = one(alt.products)?.name ?? "Alternative";
      lines.push(`Retrait alternative sur « ${pnm} » : « ${anm} ».`);
      break;
    }
  }

  const amends = buildSupplyStructuralAmends(items, draft, requestType);
  for (const e of amends) {
    const head = (e.summary ?? "").trim() || e.kind || "Mise à jour officine";
    const det = (e.detail ?? "").trim();
    lines.push(det && det !== head ? `${head} — ${det}` : head);
  }

  for (const row of items) {
    const d = draft[row.id];
    if (!d) continue;
    const b = buildItemDraftFromRow(row, requestStatus);
    const nm = validatedProductLabel(row as PatientLineLike);
    if (d.withdrawn_after_confirm !== b.withdrawn_after_confirm) {
      if (d.withdrawn_after_confirm) {
        lines.push(`« ${nm} » : retirer la ligne après validation (retrait du suivi actif).`);
      } else {
        lines.push(`« ${nm} » : rétablir la ligne (retour dans le suivi actif).`);
      }
    }
  }

  for (const row of items) {
    const alts = normalizeAlts(row.request_item_alternatives);
    const parentNm = validatedProductLabel(row as PatientLineLike);
    for (const alt of alts) {
      if (isLocalAltId(alt.id)) {
        const an = one(alt.products)?.name ?? "Alternative";
        lines.push(`Nouvelle alternative à créer sur « ${parentNm} » : « ${an} ».`);
        continue;
      }
      const dq = altQtyDrafts[alt.id];
      if (dq === undefined) continue;
      if (alt.id === row.patient_chosen_alternative_id) continue;
      if (alt.available_qty == null) continue;
      const persisted = String(alt.available_qty);
      const trimmed = String(dq).trim();
      if (trimmed === persisted) continue;
      const an = one(alt.products)?.name ?? "Alternative";
      lines.push(`« ${parentNm} » · alternative « ${an} » : quantité ${persisted} → ${trimmed}.`);
    }
  }

  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const l of lines) {
    if (seen.has(l)) continue;
    seen.add(l);
    deduped.push(l);
  }
  return deduped;
}

async function logHistory(requestId: string, oldS: string | null, newS: string, reason?: string) {
  const { data: userData } = await supabase.auth.getUser();
  return supabase.from("request_status_history").insert({
    request_id: requestId,
    old_status: oldS,
    new_status: newS,
    changed_by: userData.user?.id ?? null,
    reason: reason ?? "pharmacien_ui",
  });
}

export default function PharmacienDemandeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const { config: pricingConfig, resolve: resolveCatalogPrice } = usePharmacyPricing(request?.pharmacy_id);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [altRowsOpen, setAltRowsOpen] = useState<Record<string, boolean>>({});
  const [altPickerOpenFor, setAltPickerOpenFor] = useState<string | null>(null);
  const [lineAltTabByRowId, setLineAltTabByRowId] = useState<Record<string, PharmacistLineAltTabId>>({});
  const [availabilityMenuRowId, setAvailabilityMenuRowId] = useState<string | null>(null);
  const [altQuery, setAltQuery] = useState("");
  const [altHits, setAltHits] = useState<ProductCatalogHit[]>([]);
  const resetRespondedLineAltUi = useCallback(() => {
    setLineAltTabByRowId({});
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
  }, []);
  const [altBusyRow, setAltBusyRow] = useState<string | null>(null);
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null);
  const [fulfillmentRpcBusyId, setFulfillmentRpcBusyId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [declareTreatedBusy, setDeclareTreatedBusy] = useState(false);
  const [declareTreatedModalOpen, setDeclareTreatedModalOpen] = useState(false);
  /** Lignes dont l’éditeur post-validation est ouvert (sans modale accord par action). */
  const [supplyEditOpenRowIds, setSupplyEditOpenRowIds] = useState<Record<string, true>>({});
  /** Propositions officine persistées marquées pour retrait au prochain enregistrement. */
  const [removedPersistedProposedIds, setRemovedPersistedProposedIds] = useState<string[]>([]);
  const [removedPersistedRespondedEditIds, setRemovedPersistedRespondedEditIds] = useState<string[]>([]);
  /** Alternatives persistées marquées pour retrait au prochain enregistrement. */
  const [pendingDeletedAlternativeIds, setPendingDeletedAlternativeIds] = useState<string[]>([]);
  const [supplySaveGlobalChannel, setSupplySaveGlobalChannel] = useState("");
  const [supplySaveGlobalMotive, setSupplySaveGlobalMotive] = useState("");
  const [supplyMenuRowId, setSupplyMenuRowId] = useState<string | null>(null);
  const [pharmaHistoryRowId, setPharmaHistoryRowId] = useState<string | null>(null);
  const [productPhotoPreview, setProductPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const openProductPhotoPreview = useCallback((url: string, title: string, descriptionHtml?: string | null) => {
    setProductPhotoPreview({
      url: url.trim(),
      title: title.trim() || "Produit",
      descriptionHtml: productDescriptionHtmlForDisplay(descriptionHtml),
    });
  }, []);
  const [supplyAmendmentBundles, setSupplyAmendmentBundles] = useState<
    { id: string; created_at: string; amendments: unknown }[]
  >([]);
  const [dossierHistoryTimeline, setDossierHistoryTimeline] = useState<
    { created_at: string; old_status: string | null; new_status: string; reason: string | null }[]
  >([]);
  const [patientProfile, setPatientProfile] = useState<PatientBrief | null>(null);
  /** Affiche téléphone / e-mail sous un bouton « Contacter » (noms longs, en-tête aéré). */
  const [patientContactOpen, setPatientContactOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelModalNonce, setCancelModalNonce] = useState(0);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyRows, setHistoryRows] = useState<
    { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[]
  >([]);
  const [conversationOpen, setConversationOpen] = useState(false);
  const [conversationUnread, setConversationUnread] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<PrescriptionPagePaths | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState<string | null>(null);
  const [consultationBrief, setConsultationBrief] = useState<{
    text: string;
    paths: ConsultationImagePaths;
    contentUpdatedAt: string | null;
  } | null>(null);
  const [consultationTab, setConsultationTab] = useState<ConsultationDetailTab>("conversation");
  const [prevConsultationTabSyncKey, setPrevConsultationTabSyncKey] = useState("");
  const [conversationRefreshToken, setConversationRefreshToken] = useState(0);
  /** Après publication (`responded`), affichage figé jusqu'à « Modifier ». */
  const [respondedEditMode, setRespondedEditMode] = useState(false);
  const [respondedSaveConfirmOpen, setRespondedSaveConfirmOpen] = useState(false);
  const [respondedSaveDiffLines, setRespondedSaveDiffLines] = useState<string[]>([]);
  const [supplySaveConfirmOpen, setSupplySaveConfirmOpen] = useState(false);
  const [supplySaveConfirmLines, setSupplySaveConfirmLines] = useState<string[]>([]);
  const [supplySaveConfirmNeedsChannel, setSupplySaveConfirmNeedsChannel] = useState(false);
  const respondedEditBaselineRef = useRef<RespondedEditSnapshot | null>(null);
  const prevRespondedEditMode = useRef(false);
  /** Statut sous lequel le brouillon courant a été construit : un changement (ex. responded → confirmed)
   *  reconstruit le brouillon à neuf au lieu de préserver des valeurs périmées (faux « modifications »). */
  const draftBuiltForStatusRef = useRef<string | null>(null);
  /** Après enregistrement post-validé réussi : reconstruire le brouillon depuis la BDD sans fusion. */
  const freshDraftAfterSaveRef = useRef(false);
  /** Modal échanges patient / officine sur une ligne (id `request_items`). */
  const [lineConvoRowId, setLineConvoRowId] = useState<string | null>(null);
  /** Lignes proposées / alternatives encore non écrites en base tant que réponse pas publiée ou enregistrée (hors `confirmed`). */
  const [pendingProposalRows, setPendingProposalRows] = useState<ItemRow[]>([]);
  const [pendingAlternatives, setPendingAlternatives] = useState<PendingAlternativeEntry[]>([]);
  /** Saisie quantité alternative (id alternative locale ou UUID). */
  const [altQtyDrafts, setAltQtyDrafts] = useState<Record<string, string>>({});
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const altDebounced = useMemo(() => altQuery.trim(), [altQuery]);

  const [propOpen, setPropOpen] = useState(false);
  const [propQuery, setPropQuery] = useState("");
  const [propHits, setPropHits] = useState<ProductCatalogHit[]>([]);
  const [propReason, setPropReason] = useState("");
  const [propQty, setPropQty] = useState("1");
  const [propAvailability, setPropAvailability] = useState("available");
  const [propExpectedDate, setPropExpectedDate] = useState("");
  const [propBusy, setPropBusy] = useState(false);
  const [ordonnanceQuickAddOpen, setOrdonnanceQuickAddOpen] = useState(false);
  const [ordonnanceQuickNote, setOrdonnanceQuickNote] = useState("");
  const [ordonnanceQuickAvailability, setOrdonnanceQuickAvailability] = useState("available");
  const [ordonnanceQuickExpectedDate, setOrdonnanceQuickExpectedDate] = useState("");
  const [ordonnanceQuickRequestedQty, setOrdonnanceQuickRequestedQty] = useState("1");
  const [ordonnanceQuickAvailableQty, setOrdonnanceQuickAvailableQty] = useState("1");
  const [ordonnanceQuickAddPick, setOrdonnanceQuickAddPick] = useState<ProductCatalogHit | null>(null);
  const [ordonnanceQuickAlternatives, setOrdonnanceQuickAlternatives] = useState<OrdonnanceModalAlternativePick[]>([]);
  const [ordonnanceAltQuery, setOrdonnanceAltQuery] = useState("");
  const [ordonnanceAltHits, setOrdonnanceAltHits] = useState<ProductCatalogHit[]>([]);
  const [prescriptionScanLightbox, setPrescriptionScanLightbox] = useState<{ label: string; url: string } | null>(
    null
  );
  const [prescriptionScanPanelOpen, setPrescriptionScanPanelOpen] = useState(false);
  const [prescriptionScanActiveTab, setPrescriptionScanActiveTab] = useState<1 | 2>(1);
  /** Consultation : formulaire toujours visible (`propOpen || isConsultation`) sans ouvrir l’accordéon. */
  const propCatalogSearchActive = useMemo(
    () =>
      propOpen ||
      ordonnanceQuickAddOpen ||
      request?.request_type === "free_consultation",
    [propOpen, ordonnanceQuickAddOpen, request?.request_type]
  );
  const ordonnanceAltDebounced = useMemo(() => ordonnanceAltQuery.trim(), [ordonnanceAltQuery]);
  const propDebounced = useMemo(() => propQuery.trim(), [propQuery]);

  /** Avant première réponse : aucune ligne `pharmacist_proposed` ne doit subsister en base (anciens inserts). */
  const hideStaleServerPharmacistProposals = useMemo(
    () =>
      !!request &&
      request.request_type === "product_request" &&
      !["confirmed", "treated"].includes(request.status) &&
      ["submitted", "in_review"].includes(request.status),
    [request]
  );

  /** Ajouts officine en mémoire jusqu'à « Enregistrer les modifications » (y compris après validation patient). */
  const deferPersistOfficineAdditions = useMemo(() => {
    if (!request) return false;
    if (["confirmed", "treated"].includes(request.status)) return true;
    return (
      ["submitted", "in_review"].includes(request.status) ||
      (request.status === "responded" && respondedEditMode)
    );
  }, [request, respondedEditMode]);

  const displayRows = useMemo(() => {
    const baseRows = hideStaleServerPharmacistProposals
      ? items.filter((r) => r.line_source !== "pharmacist_proposed")
      : items.slice();
    const withSynthetic = [...baseRows, ...pendingProposalRows].filter(
      (r) => !removedPersistedRespondedEditIds.includes(r.id)
    );
    return applyPendingAlternativeDeletesToRows(
      mergePendingAlternativesOntoRows(withSynthetic, pendingAlternatives),
      pendingDeletedAlternativeIds
    );
  }, [
    items,
    hideStaleServerPharmacistProposals,
    pendingProposalRows,
    pendingAlternatives,
    pendingDeletedAlternativeIds,
    removedPersistedRespondedEditIds,
  ]);

  const catalogBlockRequestStatus = request?.status ?? null;

  const propVisibleHits = useMemo(() => {
    if (!propCatalogSearchActive || propDebounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) return [];
    return propHits.filter(
      (h) => !pharmacistRequestCatalogProductIdBlocked(h.id, displayRows, draft, catalogBlockRequestStatus)
    );
  }, [propCatalogSearchActive, propDebounced, propHits, displayRows, draft, catalogBlockRequestStatus]);

  const altPickerParentRow = useMemo(
    () => (altPickerOpenFor ? displayRows.find((r) => r.id === altPickerOpenFor) ?? null : null),
    [altPickerOpenFor, displayRows]
  );

  const altVisibleHits = useMemo(() => {
    if (altDebounced.length < 2) return [];
    const parent = altPickerParentRow;
    const parentAlts = parent ? normalizeAlts(parent.request_item_alternatives) : [];
    return altHits.filter((h) => {
      if (parent && h.id === parent.product_id) return false;
      if (parent && parentAlts.some((a) => a.product_id === h.id)) return false;
      return !pharmacistRequestCatalogProductIdBlocked(h.id, displayRows, draft, catalogBlockRequestStatus);
    });
  }, [altDebounced, altHits, altPickerParentRow, displayRows, draft, catalogBlockRequestStatus]);

  const ordonnanceAltVisibleHits = useMemo(() => {
    const pickId = ordonnanceQuickAddPick?.id;
    return ordonnanceAltHits.filter(
      (h) =>
        h.id !== pickId &&
        !ordonnanceQuickAlternatives.some((a) => a.id === h.id) &&
        !pharmacistRequestCatalogProductIdBlocked(h.id, displayRows, draft, catalogBlockRequestStatus)
    );
  }, [
    ordonnanceAltHits,
    ordonnanceQuickAddPick?.id,
    ordonnanceQuickAlternatives,
    displayRows,
    draft,
    catalogBlockRequestStatus,
  ]);

  const ordonnanceLineCount = useMemo(() => {
    if (!request || request.request_type !== "prescription") return 0;
    return displayRows.filter((r) =>
      isPrescriptionOrdonnancePrincipalLine(request.request_type, r, supplyAmendmentBundles)
    ).length;
  }, [request, displayRows, supplyAmendmentBundles]);

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    setPatientProfile(null);
    setPatientContactOpen(false);
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/pharmacien/demandes/${id}`);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (!profile || (profile as { role: string }).role !== "pharmacien") {
      setError("Accès pharmacien uniquement.");
      setLoading(false);
      return;
    }

    setSessionUserId(user.id);

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!staff?.pharmacy_id) {
      setError("Pharmacie non rattachée.");
      setLoading(false);
      return;
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from("requests")
      .select(
        "id,status,request_type,pharmacy_id,patient_id,created_at,submitted_at,responded_at,confirmed_at,updated_at,patient_planned_visit_date,patient_planned_visit_time,request_public_ref"
      )
      .eq("id", id)
      .maybeSingle();

    if (reqErr || !reqRow) {
      setError(reqErr?.message ?? "Demande introuvable.");
      setLoading(false);
      return;
    }

    const r = reqRow as RequestRow;
    if (r.pharmacy_id !== staff.pharmacy_id) {
      setError("Cette demande n’appartient pas à ta pharmacie.");
      setLoading(false);
      return;
    }

    setRequest(r);
    if (r.status !== "responded") {
      setRespondedEditMode(false);
      resetRespondedLineAltUi();
    }
    const { data: contactRpc, error: patErr } = await supabase.rpc("pharmacist_patient_contact_for_request", {
      p_request_id: id,
    });
    if (!patErr && contactRpc != null) {
      const rows = Array.isArray(contactRpc) ? contactRpc : [contactRpc];
      const first = rows[0] as PatientBrief | undefined;
      if (first) {
        setPatientProfile({
          full_name: first.full_name ?? null,
          whatsapp: first.whatsapp ?? null,
          email: first.email ?? null,
          patient_ref: first.patient_ref ?? null,
        });
      }
    }

    const { data: unreadRpc } = await supabase.rpc("request_conversation_unread_flags", { p_request_ids: [id] });
    const unreadRow = (unreadRpc as { request_id: string; has_unread: boolean }[] | null)?.find((x) => x.request_id === id);
    setConversationUnread(Boolean(unreadRow?.has_unread));

    const { data: itemsData, error: itemsErr } = await supabase
      .from("request_items")
      .select(PHARMA_REQUEST_ITEMS_SELECT)
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (itemsErr) {
      setError(itemsErr.message);
      setLoading(false);
      return;
    }

    let list = (itemsData as ItemRow[]) ?? [];
    /* Nettoyer d’anciennes propositions officine encore en base alors que la demande n’a pas encore été répondue au patient. */
    if (
      r.request_type === "product_request" &&
      ["submitted", "in_review"].includes(r.status) &&
      list.some((row) => row.line_source === "pharmacist_proposed")
    ) {
      const { error: delStale } = await supabase
        .from("request_items")
        .delete()
        .eq("request_id", id)
        .eq("line_source", "pharmacist_proposed");
      if (delStale) {
        setError(delStale.message);
        setLoading(false);
        return;
      }
      const { data: itemsDataRetry, error: itemsErrRetry } = await supabase
        .from("request_items")
        .select(PHARMA_REQUEST_ITEMS_SELECT)
        .eq("request_id", id)
        .order("created_at", { ascending: true });
      if (itemsErrRetry) {
        setError(itemsErrRetry.message);
        setLoading(false);
        return;
      }
      list = (itemsDataRetry as ItemRow[]) ?? [];
    }

    setItems(mapRequestItemsPhotos(list));
    setAltQtyDrafts({});

    if (r.request_type === "prescription") {
      const { data: prRow, error: prErr } = await supabase
        .from("prescription_requests")
        .select("prescription_image_url,page_2_path,patient_note")
        .eq("request_id", id)
        .maybeSingle();
      if (prErr) {
        setError(prErr.message);
        setLoading(false);
        return;
      }
      if (prRow) {
        const pr = prRow as { prescription_image_url: string | null; page_2_path: string | null; patient_note: string | null };
        setPrescriptionPaths({ page1: pr.prescription_image_url, page2: pr.page_2_path });
        setPrescriptionNote(pr.patient_note);
      } else {
        setPrescriptionPaths(null);
        setPrescriptionNote(null);
      }
      setConsultationBrief(null);
    } else if (r.request_type === "free_consultation") {
      setPrescriptionPaths(null);
      setPrescriptionNote(null);
      const { data: crRow, error: crErr } = await supabase
        .from("free_consultation_requests")
        .select("consultation_text,image_1_path,image_2_path,image_3_path,patient_content_updated_at")
        .eq("request_id", id)
        .maybeSingle();
      if (crErr) {
        setError(crErr.message);
        setLoading(false);
        return;
      }
      if (crRow) {
        const cr = crRow as {
          consultation_text: string;
          image_1_path: string | null;
          image_2_path: string | null;
          image_3_path: string | null;
          patient_content_updated_at: string | null;
        };
        setConsultationBrief({
          text: cr.consultation_text,
          paths: { photo1: cr.image_1_path, photo2: cr.image_2_path, photo3: cr.image_3_path },
          contentUpdatedAt: cr.patient_content_updated_at,
        });
      } else {
        setConsultationBrief(null);
      }
    } else {
      setPrescriptionPaths(null);
      setPrescriptionNote(null);
      setConsultationBrief(null);
    }

    const [{ data: amendRows }, { data: dossierHist }] = await Promise.all([
      supabase.from("request_supply_amendments").select("id,created_at,amendments").eq("request_id", id).order("created_at", { ascending: true }),
      supabase
        .from("request_status_history")
        .select("created_at,old_status,new_status,reason")
        .eq("request_id", id)
        .order("created_at", { ascending: true })
        .limit(120),
    ]);
    setSupplyAmendmentBundles((amendRows as { id: string; created_at: string; amendments: unknown }[]) ?? []);
    setDossierHistoryTimeline(
      (dossierHist as { created_at: string; old_status: string | null; new_status: string; reason: string | null }[]) ?? []
    );

    /** Ne pas réécraser le brouillon des lignes encore présentes (ex. après insert ligne proposée + reload).
     *  Mais si le statut a changé (ex. responded → confirmed après validation patient), repartir d'un
     *  brouillon neuf : sinon des valeurs de l'ancien statut feraient apparaître la barre « Enregistrer ». */
    const statusChangedSincePrevDraft = draftBuiltForStatusRef.current !== r.status;
    const forceFreshDraft = freshDraftAfterSaveRef.current;
    if (forceFreshDraft) freshDraftAfterSaveRef.current = false;
    draftBuiltForStatusRef.current = r.status;
    setDraft((prev) => {
      const next: Draft = {};
      for (const row of list) {
        const built = buildItemDraftFromRow(row, r.status, r.request_type);
        next[row.id] =
          statusChangedSincePrevDraft || forceFreshDraft
            ? built
            : mergeItemDraftOnReload(row, built, prev[row.id], r.status);
      }
      return next;
    });
    setLoading(false);
  }, [id, router, resetRespondedLineAltUi]);

  const requestDrift = useRequestDetailDrift(id, request?.status, "pharmacien", load);
  const { acknowledge: acknowledgeRequestDrift } = requestDrift;

  useEffect(() => {
    if (!request?.updated_at) return;
    acknowledgeRequestDrift(request.updated_at, request.status);
  }, [request?.id, request?.updated_at, request?.status, acknowledgeRequestDrift]);

  const persistPostConfirmFulfillmentForRow = useCallback(
    async (rowSnap: ItemRow, pcf: "unset" | "reserved" | "ordered" | "arrived_reserved") => {
      if (!id) return;
      const baselineDraft = buildItemDraftFromRow(rowSnap, request?.status ?? null, request?.request_type);
      const liveDraft = draft[rowSnap.id] ?? baselineDraft;
      const eff = effectiveAvailSupplyDraft(rowSnap, liveDraft, request?.request_type);
      const inferred = eff ?? "";
      const next = clampFulfillmentDraftToInferred(pcf, inferred);
      if (next !== pcf) {
        setError(
          "« Réservé » ou « Commandé » ne correspond pas à la disponibilité actuelle en base pour cette ligne. Enregistrez d’abord les changements de disponibilité (ou la date prévue pour commande) si besoin."
        );
        return;
      }
      if (next === "ordered" && inferred === "to_order") {
        const eta = effectiveEtaSupplyDraft(rowSnap, liveDraft, request?.request_type, request?.status);
        if (!eta || !eta.trim()) {
          setError(
            "Indiquez la date prévisionnelle de réception (« à commander ») avant de marquer la ligne comme commandée."
          );
          return;
        }
        try {
          assertReceptionDateNotBeforeToday(eta, one(rowSnap.products)?.name ?? undefined);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Date de réception invalide.");
          return;
        }
      }
      setDraft((prev) => {
        const cur = prev[rowSnap.id] ?? liveDraft;
        return { ...prev, [rowSnap.id]: { ...cur, fulfillment_draft: next } };
      });
      setFulfillmentRpcBusyId(rowSnap.id);
      setError("");
      try {
        const { error } = await supabase.rpc("pharmacist_set_post_confirm_fulfillment", {
          p_request_item_id: rowSnap.id,
          p_fulfillment: next,
        });
        if (error) throw new Error(error.message);
        dispatchRequestDetailRefresh(id);
        setItems((prev) =>
          prev.map((r) =>
            r.id === rowSnap.id ? { ...r, post_confirm_fulfillment: next } : r
          )
        );
        setDraft((prev) => {
          const synced = buildItemDraftFromRow(
            { ...rowSnap, post_confirm_fulfillment: next },
            request?.status ?? null,
            request?.request_type
          );
          return { ...prev, [rowSnap.id]: synced };
        });
      } catch (e) {
        setDraft((prev) => {
          const cur = prev[rowSnap.id] ?? liveDraft;
          return { ...prev, [rowSnap.id]: { ...cur, fulfillment_draft: liveDraft.fulfillment_draft } };
        });
        setError(e instanceof Error ? e.message : "Impossible d’enregistrer.");
      } finally {
        setFulfillmentRpcBusyId(null);
      }
    },
    [id, request, draft]
  );

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<RequestDetailRefreshDetail>).detail;
      if (detail?.requestId !== id) return;
      if (detail.focus === "conversation") {
        setConsultationTab("conversation");
        setConversationRefreshToken((t) => t + 1);
        setConversationOpen(true);
      }
      void load();
    };
    window.addEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(REQUEST_DETAIL_REFRESH_EVENT, listener);
  }, [id, load]);

  useEffect(() => {
    if (altDebounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS || !altPickerOpenFor) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const sanitized = sanitizeProductSearchQuery(altDebounced);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setAltHits([]);
          return;
        }
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,brand,laboratory,photo_url,price_pph,price_ppv,full_description")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);
        if (error || !Array.isArray(data)) {
          setAltHits([]);
          return;
        }
        setAltHits(
          (data as ProductCatalogHit[]).map((p) => ({
            ...p,
            photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          }))
        );
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [altDebounced, altPickerOpenFor]);

  useEffect(() => {
    if (availabilityMenuRowId === null) return undefined;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const anchor = document.querySelector(`[data-pharma-avail-anchor="${availabilityMenuRowId}"]`);
      const menu = document.querySelector(`[data-pharma-avail-menu="${availabilityMenuRowId}"]`);
      if (anchor instanceof HTMLElement && anchor.contains(t)) return;
      if (menu instanceof HTMLElement && menu.contains(t)) return;
      setAvailabilityMenuRowId(null);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [availabilityMenuRowId]);

  useEffect(() => {
    if (propDebounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS || !propCatalogSearchActive) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const sanitized = sanitizeProductSearchQuery(propDebounced);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setPropHits([]);
          return;
        }
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,brand,laboratory,photo_url,price_pph,price_ppv,full_description")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);
        if (error || !Array.isArray(data)) {
          setPropHits([]);
          return;
        }
        setPropHits(
          (data as ProductCatalogHit[]).map((p) => ({
            ...p,
            photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          }))
        );
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [propDebounced, propCatalogSearchActive]);

  useEffect(() => {
    if (!ordonnanceQuickAddOpen || ordonnanceAltDebounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        const sanitized = sanitizeProductSearchQuery(ordonnanceAltDebounced);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setOrdonnanceAltHits([]);
          return;
        }
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,brand,laboratory,photo_url,price_pph,price_ppv,full_description")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);
        if (error || !Array.isArray(data)) {
          setOrdonnanceAltHits([]);
          return;
        }
        setOrdonnanceAltHits(
          (data as ProductCatalogHit[]).map((p) => ({
            ...p,
            photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          }))
        );
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [ordonnanceAltDebounced, ordonnanceQuickAddOpen]);

  const setField = (itemId: string, field: keyof ItemDraft, value: string) => {
    setDraft((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const setReceptionDateField = (itemId: string, raw: string) => {
    const v = raw.trim().slice(0, 10);
    if (v && v < todayLocalIsoDate()) return;
    setField(itemId, "expected_availability_date", raw);
  };

  const receptionDateMinYmd = todayLocalIsoDate();
  const receptionDateMaxYmdVal = receptionDateMaxYmd();

  const patchItemDraft = useCallback((itemId: string, patch: Partial<ItemDraft>) => {
    setDraft((prev) => {
      const cur = prev[itemId];
      if (!cur) return prev;
      return { ...prev, [itemId]: { ...cur, ...patch } };
    });
  }, []);

  /** Ligne validée : quantité préparation ≤ choix patient tant que pas « récupéré » ; sinon plafonné à 10. */
  const maxPreparationQtyForRow = useCallback(
    (row: ItemRow): number => {
      if (!request || !["confirmed", "treated"].includes(request.status)) return 10;
      if (!row.is_selected_by_patient) return 10;
      const co = row.counter_outcome ?? "unset";
      if (co === "picked_up") return 10;
      return PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX;
    },
    [request]
  );

  /** Plafond de saisie « Stock » : lignes patient ≤ quantité demandée (+ règle comptoir si applicable) ; propositions officine : plafond technique seulement. */
  const draftStockCeilingForRow = useCallback(
    (row: ItemRow): number => {
      if (request && isPrescriptionOrdonnancePharmacistLine(request.request_type, row)) {
        const f = draft[row.id];
        return ordonnanceDraftRequestedQty(row, f);
      }
      if (row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id)) {
        return PHARMACIST_PROPOSED_STOCK_CEILING;
      }
      if (request && ["confirmed", "treated"].includes(request.status) && row.is_selected_by_patient) {
        return PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX;
      }
      const rqRaw = Number(row.requested_qty);
      const reqCap = Number.isFinite(rqRaw) ? Math.max(0, Math.floor(rqRaw)) : 0;
      return Math.min(maxPreparationQtyForRow(row), reqCap);
    },
    [maxPreparationQtyForRow, request, draft]
  );

  const setAvailabilityStatus = (row: ItemRow, nextStatus: string) => {
    const isAjoutOfficine =
      request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
    const isPharmacistProposed = isPharmacistProposedRow(row);
    const isOrdonnancePharma =
      request != null && isPrescriptionOrdonnancePharmacistLine(request.request_type, row);
    const isPrescriptionExtraProposed =
      request != null &&
      isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
    const isProposedForAvailInference = isProposedLineForAvailabilityInference(
      request?.request_type ?? "product_request",
      row,
      supplyAmendmentBundles,
      { isAjoutOfficineLine: isAjoutOfficine, isPrescriptionExtraProposed }
    );
    const refR = isOrdonnancePharma
      ? ordonnanceDraftRequestedQty(row, draft[row.id])
      : inferRequestedQtyForAvailability(row);
    setDraft((prev) => {
      const current = prev[row.id];
      if (!current) return prev;
      let qty = Number(current.available_qty || "0");
      if (!Number.isFinite(qty)) qty = 0;
      if (nextStatus === "market_shortage" || nextStatus === "unavailable") qty = 0;
      const cap = draftStockCeilingForRow(row);
      if (nextStatus === "to_order") {
        qty =
          isAjoutOfficine || isPharmacistProposed
            ? Math.max(1, Math.min(10, qty || Number(current.available_qty) || 1))
            : Math.min(cap, refR);
      }
      if (nextStatus === "available") {
        qty =
          isAjoutOfficine || isPharmacistProposed
            ? Math.max(1, Math.min(10, qty || Number(current.available_qty) || 1))
            : Math.min(cap, refR);
      }
      const minQty = isAjoutOfficine || isPharmacistProposed ? 1 : 0;
      const nextAvailNum = Math.max(minQty, Math.min(cap, qty));
      if (isOrdonnancePharma) {
        const patch = applyOrdonnanceAvailabilityChange(nextStatus, refR, nextAvailNum);
        const inferredStatus = inferAvailabilityStatusFromQty({
          status: patch.availability,
          availableQty: patch.availableQty,
          requestedQty: refR,
          isProposedLine: false,
        });
        const fulfillment_draft = fulfillmentDraftAfterAvailabilityChange(
          current.fulfillment_draft,
          inferredStatus
        );
        const clearEta = inferredStatus !== "to_order";
        return {
          ...prev,
          [row.id]: {
            ...current,
            availability_status: inferredStatus,
            available_qty: String(patch.availableQty),
            fulfillment_draft,
            expected_availability_date: clearEta ? "" : current.expected_availability_date,
          },
        };
      }
      const nextAvail = String(nextAvailNum);
      const inferred = inferAvailabilityStatusFromQty({
        status: nextStatus,
        availableQty: Number(nextAvail),
        requestedQty: refR,
        isProposedLine: isProposedForAvailInference,
      });
      const fulfillment_draft = fulfillmentDraftAfterAvailabilityChange(current.fulfillment_draft, inferred);
      const clearEta = inferred !== "to_order";
      return {
        ...prev,
        [row.id]: {
          ...current,
          availability_status: inferred,
          available_qty: nextAvail,
          fulfillment_draft,
          expected_availability_date: clearEta ? "" : current.expected_availability_date,
        },
      };
    });
    if (request && ["confirmed", "treated"].includes(request.status) && nextStatus === "to_order") {
      setSupplyEditOpenRowIds((prev) => ({ ...prev, [row.id]: true }));
    }
  };

  const setOrdonnanceRequestedQty = (row: ItemRow, raw: string) => {
    const cur = draft[row.id];
    if (!cur) return;
    const prevReq = ordonnanceDraftRequestedQty(row, cur);
    const applied = applyOrdonnanceRequestedQtyChange(
      raw,
      prevReq,
      Number(cur.available_qty) || 0,
      cur.availability_status
    );
    if (!applied) {
      if (raw.replace(/[^\d]/g, "") === "") {
        setField(row.id, "requested_qty_str", "");
      }
      return;
    }
    const inferred = inferAvailabilityStatusFromQty({
      status: applied.availability,
      availableQty: applied.availableQty,
      requestedQty: applied.requestedQty,
      isProposedLine: false,
    });
    setDraft((prev) => ({
      ...prev,
      [row.id]: {
        ...cur,
        requested_qty_str: String(applied.requestedQty),
        available_qty: String(applied.availableQty),
        availability_status: inferred,
      },
    }));
    if (isLocalProposedItemId(row.id)) {
      setPendingProposalRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                requested_qty: applied.requestedQty,
                available_qty: applied.availableQty,
                availability_status: inferred,
              }
            : r
        )
      );
    }
  };

  const syncPendingLocalProposedQty = useCallback((rowId: string, qty: number, availabilityStatus?: string) => {
    setPendingProposalRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              requested_qty: qty,
              selected_qty: qty,
              available_qty: qty,
              ...(availabilityStatus != null ? { availability_status: availabilityStatus } : {}),
            }
          : r
      )
    );
  }, []);

  const setAvailableQty = (row: ItemRow, raw: string) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage") return;
    const isAjoutOfficine =
      request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
    const isPrescriptionExtraProposed =
      request != null &&
      isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
    const isPharmacistProposed = isPharmacistProposedRow(row);
    const isProposedForAvailInference = isProposedLineForAvailabilityInference(
      request?.request_type ?? "product_request",
      row,
      supplyAmendmentBundles,
      {
        isAjoutOfficineLine: isAjoutOfficine,
        isPrescriptionExtraProposed,
      }
    );
    const isOrdonnancePharma =
      request != null && isPrescriptionOrdonnancePharmacistLine(request.request_type, row);
    if (isOrdonnancePharma) {
      const cur = draft[row.id];
      if (!cur) return;
      const req = ordonnanceDraftRequestedQty(row, cur);
      const applied = applyOrdonnanceAvailableQtyChange(raw, req, cur.availability_status);
      if (!applied) {
        if (raw.replace(/[^\d]/g, "") === "") setField(row.id, "available_qty", "");
        return;
      }
      const inferred = inferAvailabilityStatusFromQty({
        status: applied.availability,
        availableQty: applied.availableQty,
        requestedQty: req,
        isProposedLine: false,
      });
      setDraft((prev) => ({
        ...prev,
        [row.id]: { ...cur, available_qty: String(applied.availableQty), availability_status: inferred },
      }));
      return;
    }
    const max = draftStockCeilingForRow(row);
    if (status === "to_order") {
      const digits = raw.replace(/[^\d]/g, "");
      if (digits === "") {
        setField(row.id, "available_qty", "");
        return;
      }
      const capToOrder =
        isPharmacistProposed && request?.request_type === "product_request"
          ? 10
          : max;
      const n = Math.min(capToOrder, Math.max(1, Number(digits)));
      const nextQty = Number.isFinite(n) ? n : 1;
      setDraft((prev) => {
        const cur = prev[row.id];
        if (!cur) return prev;
        const fulfillment_draft = fulfillmentDraftAfterAvailabilityChange(cur.fulfillment_draft, "to_order");
        const reqSt = request?.status ?? null;
        return {
          ...prev,
          [row.id]: withSyncedPostConfirmQtyDraft(row, reqSt, {
            ...cur,
            available_qty: String(nextQty),
            availability_status: "to_order",
            fulfillment_draft,
          }),
        };
      });
      if (isLocalProposedItemId(row.id)) {
        syncPendingLocalProposedQty(row.id, nextQty, "to_order");
      }
      return;
    }
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      setField(row.id, "available_qty", "");
      return;
    }
    const n = Math.min(
      isPharmacistProposed && request?.request_type === "product_request" ? 10 : max,
      Math.max(isAjoutOfficine || isPrescriptionExtraProposed || isPharmacistProposed ? 1 : 0, Number(digits))
    );
    const nextQty = Number.isFinite(n) ? n : 0;
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: nextQty,
      requestedQty: inferRequestedQtyForAvailability(row),
      isProposedLine: isProposedForAvailInference,
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = inferred;
      const fulfillment_draft = fulfillmentDraftAfterAvailabilityChange(cur.fulfillment_draft, nextStatus);
      const reqSt = request?.status ?? null;
      return {
        ...prev,
        [row.id]: withSyncedPostConfirmQtyDraft(row, reqSt, {
          ...cur,
          available_qty: String(nextQty),
          availability_status: nextStatus,
          fulfillment_draft,
        }),
      };
    });
    if (isLocalProposedItemId(row.id)) {
      syncPendingLocalProposedQty(row.id, Math.max(1, nextQty), inferred);
    }
  };

  const nudgeAvailableQty = (row: ItemRow, delta: number) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage") return;
    const isAjoutOfficine =
      request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
    const isPrescriptionExtraProposed =
      request != null &&
      isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
    const isOrdonnancePharma =
      request != null && isPrescriptionOrdonnancePharmacistLine(request.request_type, row);
    if (isOrdonnancePharma) {
      const cur = draft[row.id];
      if (!cur) return;
      const req = ordonnanceDraftRequestedQty(row, cur);
      const applied = nudgeOrdonnanceAvailableQty(delta, req, Number(cur.available_qty) || 0, cur.availability_status);
      const inferred = inferAvailabilityStatusFromQty({
        status: applied.availability,
        availableQty: applied.availableQty,
        requestedQty: req,
        isProposedLine: false,
      });
      setDraft((prev) => ({
        ...prev,
        [row.id]: { ...cur, available_qty: String(applied.availableQty), availability_status: inferred },
      }));
      return;
    }
    const max = draftStockCeilingForRow(row);
    if (status === "to_order") {
      const current = Number(draft[row.id]?.available_qty ?? "0");
      const next = Math.min(max, Math.max(1, Number.isFinite(current) ? current + delta : delta > 0 ? 1 : 1));
      setDraft((prev) => {
        const cur = prev[row.id];
        if (!cur) return prev;
        const fulfillment_draft = fulfillmentDraftAfterAvailabilityChange(cur.fulfillment_draft, "to_order");
        return {
          ...prev,
          [row.id]: {
            ...cur,
            available_qty: String(next),
            availability_status: "to_order",
            fulfillment_draft,
          },
        };
      });
      if (isLocalProposedItemId(row.id)) {
        syncPendingLocalProposedQty(row.id, next, "to_order");
      }
      return;
    }
    const current = Number(draft[row.id]?.available_qty ?? "0");
    const floor = isAjoutOfficine || isPrescriptionExtraProposed ? 1 : 0;
    const next = Math.min(
      max,
      Math.max(floor, Number.isFinite(current) ? current + delta : delta > 0 ? 1 : 0)
    );
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: next,
      requestedQty: inferRequestedQtyForAvailability(row),
      isProposedLine: isAjoutOfficine || isPrescriptionExtraProposed,
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = inferred;
      const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, nextStatus);
      const reqSt = request?.status ?? null;
      return {
        ...prev,
        [row.id]: withSyncedPostConfirmQtyDraft(row, reqSt, {
          ...cur,
          available_qty: String(next),
          availability_status: nextStatus,
          fulfillment_draft,
        }),
      };
    });
    if (isLocalProposedItemId(row.id)) {
      syncPendingLocalProposedQty(row.id, Math.max(1, next), inferred);
    }
  };

  const clearAltPickerSearch = () => {
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
  };

  const resetAltPicker = (parentRowId?: string) => {
    clearAltPickerSearch();
    if (parentRowId) {
      setLineAltTabByRowId((prev) => {
        if (prev[parentRowId] !== PHARMACIST_ALT_TAB_ADD) return prev;
        return { ...prev, [parentRowId]: "principal" };
      });
    }
  };

  const isAltOpen = (rowId: string) => altRowsOpen[rowId] ?? false;
  const toggleAltOpen = (rowId: string) =>
    setAltRowsOpen((prev) => ({ ...prev, [rowId]: !(prev[rowId] ?? false) }));

  const persistAlternativeQtyUpdates = useCallback(async (rows: ItemRow[], drafts: Record<string, string>) => {
    for (const row of rows) {
      if (isLocalProposedItemId(row.id)) continue;
      const alts = normalizeAlts(row.request_item_alternatives);
      for (const alt of alts) {
        if (isLocalAltId(alt.id)) continue;
        const fallback = clampAlternativeAvailableQty(Number(alt.available_qty ?? row.requested_qty));
        const raw = drafts[alt.id];
        const next =
          raw !== undefined && String(raw).trim() !== ""
            ? clampAlternativeAvailableQty(Number(String(raw).replace(/[^\d]/g, "")))
            : fallback;
        if (next === Number(alt.available_qty)) continue;
        const { error } = await supabase
          .from("request_item_alternatives")
          .update({ available_qty: next })
          .eq("id", alt.id);
        if (error) throw new Error(error.message);
      }
    }
  }, []);

  const patchPendingAlternativeQty = (localAltId: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    const n = clampAlternativeAvailableQty(Number(digits || "1"));
    setPendingAlternatives((prev) => prev.map((a) => (a.localAltId === localAltId ? { ...a, available_qty: n } : a)));
  };

  const removePharmacistProposedLine = async (row: ItemRow) => {
    const canRemove =
      isPharmacistProposedRow(row) ||
      (request?.status === "responded" &&
        respondedEditMode &&
        isPrescriptionOrdonnancePrincipalLine(request.request_type, row, supplyAmendmentBundles));
    if (!canRemove) return;
    setError("");
    if (isLocalProposedItemId(row.id)) {
      setPendingProposalRows((prev) => prev.filter((r) => r.id !== row.id));
      setDraft((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      setPendingAlternatives((prev) => prev.filter((a) => a.parentItemId !== row.id));
      return;
    }
    if (!id || !request) return;
    if (request.status === "responded" && respondedEditMode) {
      setRemovedPersistedRespondedEditIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      setDraft((prev) => {
        const n = { ...prev };
        delete n[row.id];
        return n;
      });
      setSupplyEditOpenRowIds((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setLineAltTabByRowId((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    if (["confirmed", "treated"].includes(request.status)) {
      if (!isPharmacistProposedRow(row)) return;
      setRemovedPersistedProposedIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
      setSupplyEditOpenRowIds((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("request_items")
      .delete()
      .eq("id", row.id)
      .eq("line_source", "pharmacist_proposed");
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const resetPropForm = () => {
    setPropQuery("");
    setPropHits([]);
    setPropReason("");
    setPropQty("1");
    setPropAvailability("available");
    setPropExpectedDate("");
  };

  const resetOrdonnanceQuickAddForm = () => {
    setPropQuery("");
    setPropHits([]);
    setPropQty("1");
    setOrdonnanceQuickNote("");
    setOrdonnanceQuickAvailability("available");
    setOrdonnanceQuickExpectedDate("");
    setOrdonnanceQuickRequestedQty("1");
    setOrdonnanceQuickAvailableQty("1");
    setOrdonnanceQuickAddPick(null);
    setOrdonnanceQuickAlternatives([]);
    setOrdonnanceAltQuery("");
    setOrdonnanceAltHits([]);
  };

  const openPostConfirmAddPreface = (mode: "ordonnance" | "proposed") => {
    setError("");
    if (mode === "ordonnance") {
      resetOrdonnanceQuickAddForm();
      setOrdonnanceQuickAddOpen(true);
    } else {
      resetPropForm();
      setPropOpen(true);
    }
  };

  const insertPharmacistProposedLine = async (
    pick: ProductCatalogHit,
    opts?: {
      qty?: number;
      requestedQty?: number;
      availableQty?: number;
      availability?: string;
      pharmacistComment?: string;
      expectedAvailabilityDate?: string;
      fromQuickAdd?: boolean;
      lineKind?: "ordonnance" | "proposed";
      alternatives?: OrdonnanceModalAlternativePick[];
    }
  ) => {
    if (!id) return;
    setError("");
    let reason = propReason.trim();
    const isOrdonnanceInsert =
      request?.request_type === "prescription" &&
      (opts?.lineKind === "ordonnance" || opts?.fromQuickAdd);
    if (request?.request_type === "prescription") {
      if (isOrdonnanceInsert) {
        reason = "";
      } else if (reason.length > 0 && reason.length < 3) {
        setError("Indique un motif d’au moins 3 caractères pour proposer ce produit.");
        return;
      }
    } else if (request?.request_type === "free_consultation") {
      reason = "";
    } else if (reason.length < 3) {
      setError("Indique un motif d’au moins 3 caractères pour proposer ce produit.");
      return;
    }
    const isPrescriptionInsert = isOrdonnanceInsert;
    const requestedQty = isPrescriptionInsert
      ? clampOrdonnanceRequestedQty(
          opts?.requestedQty ??
            opts?.qty ??
            (parseInt(ordonnanceQuickRequestedQty, 10) || 1)
        )
      : Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, Math.max(1, opts?.qty ?? 1));
    const availRawForInsert = opts?.availability ?? ordonnanceQuickAvailability;
    const parsedAvailOpt =
      opts?.availableQty ??
      (ordonnanceQuickAvailableQty.trim() === ""
        ? undefined
        : parseInt(ordonnanceQuickAvailableQty, 10));
    const availableQty = isPrescriptionInsert
      ? ordonnanceInsertAvailableQty(availRawForInsert, requestedQty, parsedAvailOpt)
      : requestedQty;
    const qty = isPrescriptionInsert ? availableQty : requestedQty;
    const availRaw = opts?.availability ?? (isPrescriptionInsert ? availRawForInsert : propAvailability);
    const avail = isPrescriptionInsert
      ? inferAvailabilityStatusFromQty({
          status: availRaw,
          availableQty,
          requestedQty,
          isProposedLine: false,
        })
      : availRaw;
    const pharmacistComment = (opts?.pharmacistComment ?? "").trim() || null;
    const etaYmd = (opts?.expectedAvailabilityDate ?? propExpectedDate ?? "").trim();
    const needsEta = availRaw === "to_order" || avail === "to_order";
    if (needsEta && !etaYmd) {
      setError("Indiquez la date de réception prévue pour « À commander ».");
      return;
    }
    if (etaYmd) {
      try {
        assertReceptionDateNotBeforeToday(etaYmd, pick.name);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Date de réception invalide.");
        return;
      }
    }
    const expectedDateValue = needsEta && etaYmd ? etaYmd : null;
    if (pharmacistRequestCatalogProductIdBlocked(pick.id, displayRows, draft, catalogBlockRequestStatus)) {
      setError(pharmacistRequestCatalogProductBlockMessageFr(request?.status ?? null));
      return;
    }
    const postConfirmImmediatePersist =
      !!request && ["confirmed", "treated"].includes(request.status);
    if (deferPersistOfficineAdditions) {
      const prefPrice =
        resolveCatalogPrice(catalogHitToPricingInput(pick));
      const safeAvailableQty = isPrescriptionInsert
        ? availableQty
        : Math.max(1, Math.floor(Number(availableQty)) || 1);
      const syntheticId = newLocalProposedId();
      const syntheticRow: ItemRow = {
        id: syntheticId,
        product_id: pick.id,
        requested_qty: requestedQty,
        availability_status: avail,
        available_qty: safeAvailableQty,
        unit_price: prefPrice,
        pharmacist_comment: pharmacistComment,
        client_comment: null,
        line_source: isOrdonnanceInsert ? "patient_request" : "pharmacist_proposed",
        pharmacist_proposal_reason:
          isOrdonnanceInsert || request?.request_type === "free_consultation" ? null : reason,
        expected_availability_date: expectedDateValue,
        counter_outcome: "unset",
        counter_cancel_reason: null,
        counter_cancel_detail: null,
        is_selected_by_patient: true,
        selected_qty: requestedQty,
        patient_chosen_alternative_id: null,
        post_confirm_fulfillment: request?.status === "treated" ? "reserved" : "unset",
        withdrawn_after_confirm: false,
        updated_at: new Date().toISOString(),
        products: {
          name: pick.name,
          price_pph: pick.price_pph ?? null,
          photo_url: pick.photo_url ?? null,
        },
        request_item_alternatives: null,
      };
      setPendingProposalRows((prev) => [...prev, syntheticRow]);
      const builtDraft = buildItemDraftFromRow(syntheticRow, request?.status ?? null, request?.request_type);
      const inferredDraftStatus = inferAvailabilityStatusFromQty({
        status: builtDraft.availability_status,
        availableQty: Number(builtDraft.available_qty) || 0,
        requestedQty: requestedQty,
        isProposedLine: false,
      });
      setDraft((prev) => ({
        ...prev,
        [syntheticId]: {
          ...builtDraft,
          availability_status:
            inferredDraftStatus === "partially_available" ? "available" : inferredDraftStatus,
          requested_qty_str: String(requestedQty),
        },
      }));
      if (["confirmed", "treated"].includes(request?.status ?? "")) {
        setSupplyEditOpenRowIds((prev) => ({ ...prev, [syntheticId]: true }));
      }
      const altPicks = opts?.alternatives ?? [];
      if (altPicks.length > 0) {
        let altValidationError: string | null = null;
        flushSync(() => {
          setPendingAlternatives((prev) => {
            const mergedExisting = pendingAltsAsRankedDb(prev, syntheticId);
            let next = [...prev];
            for (const alt of altPicks.slice(0, 3)) {
              if (alt.id === pick.id) continue;
              const mergedForRank = [
                ...mergedExisting,
                ...pendingAltsAsRankedDb(next, syntheticId),
              ];
              if (mergedForRank.some((a) => a.product_id === alt.id)) {
                altValidationError = "Cette alternative figure déjà sur cette ligne.";
                return prev;
              }
              if (pharmacistRequestCatalogProductIdBlocked(alt.id, displayRows, draft, catalogBlockRequestStatus)) {
                altValidationError = pharmacistRequestCatalogProductBlockMessageFr(request?.status ?? null);
                return prev;
              }
              const rank = nextAltRank(mergedForRank);
              if (rank == null) {
                altValidationError = "Maximum 3 alternatives par ligne.";
                return prev;
              }
              const prefPrice =
                resolveCatalogPrice(
                  catalogHitToPricingInput({
                    ...alt,
                    product_type: alt.product_type ?? "parapharmacie",
                  })
                );
              next = [
                ...next,
                {
                  localAltId: newLocalAltId(),
                  parentItemId: syntheticId,
                  rank,
                  product_id: alt.id,
                  availability_status: "available",
          available_qty: Math.max(1, alt.available_qty ?? availableQty),
          pharmacist_comment: null,
          unit_price: prefPrice,
          expected_availability_date: null,
          products: {
            name: alt.name,
            price_pph: alt.price_pph ?? null,
            photo_url: alt.photo_url ?? null,
          },
        },
              ];
            }
            return next;
          });
        });
        if (altValidationError) {
          setError(altValidationError);
          return;
        }
      }
      if (!opts?.fromQuickAdd && typeof window !== "undefined") {
        requestAnimationFrame(() => {
          const el = document.querySelector(`[data-pharma-supply-editor="${syntheticId}"]`);
          if (!el) return;
          const rect = el.getBoundingClientRect();
          const headerOffset = 72;
          if (rect.top >= headerOffset && rect.bottom <= window.innerHeight - 24) return;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      if (opts?.fromQuickAdd) {
        resetOrdonnanceQuickAddForm();
        setOrdonnanceQuickAddOpen(false);
      } else {
        if (request?.request_type !== "free_consultation") setPropOpen(false);
        resetPropForm();
      }
      return;
    }
    setPropBusy(true);
    const { data: insertedRow, error: insErr } = await supabase
      .from("request_items")
      .insert({
        request_id: id,
        product_id: pick.id,
        requested_qty: requestedQty,
        availability_status: avail,
        available_qty: availableQty,
        expected_availability_date: expectedDateValue,
        line_source: isOrdonnanceInsert ? "patient_request" : "pharmacist_proposed",
        pharmacist_proposal_reason:
          isOrdonnanceInsert || request?.request_type === "free_consultation" ? null : reason,
        pharmacist_comment: pharmacistComment,
        is_selected_by_patient: true,
        selected_qty: requestedQty,
        counter_outcome: "unset",
      })
      .select("id")
      .single();
    if (insErr) {
      setPropBusy(false);
      setError(insErr.message);
      return;
    }
    const altPicks = opts?.alternatives ?? [];
    if (insertedRow?.id && altPicks.length > 0) {
      let rank = 1;
      for (const alt of altPicks.slice(0, 3)) {
        if (alt.id === pick.id) continue;
        if (pharmacistRequestCatalogProductIdBlocked(alt.id, displayRows, draft, catalogBlockRequestStatus)) {
          setPropBusy(false);
          setError(pharmacistRequestCatalogProductBlockMessageFr(request?.status ?? null));
          return;
        }
        const prefPrice = resolveCatalogPrice(
          catalogHitToPricingInput({
            ...alt,
            product_type: alt.product_type ?? "parapharmacie",
          })
        );
        const { error: altErr } = await supabase.from("request_item_alternatives").insert({
          request_item_id: insertedRow.id,
          rank,
          product_id: alt.id,
          availability_status: "available",
          available_qty: Math.max(1, alt.available_qty ?? availableQty),
          pharmacist_comment: null,
          unit_price: prefPrice,
          expected_availability_date: null,
        });
        if (altErr) {
          setPropBusy(false);
          setError(altErr.message);
          return;
        }
        rank += 1;
      }
    }
    setPropBusy(false);
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_product_added");
      if (h) {
        setError(h.message);
        return;
      }
    }
    if (opts?.fromQuickAdd) {
      resetOrdonnanceQuickAddForm();
      setOrdonnanceQuickAddOpen(false);
    } else {
      if (request?.request_type !== "free_consultation") setPropOpen(false);
      resetPropForm();
    }
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const insertAlternative = async (parentRow: ItemRow, pick: ProductCatalogHit) => {
    const catalogProductId = pick.id;
    setError("");
    if (catalogProductId === parentRow.product_id) {
      setError("Choisis un produit différent de la ligne principale.");
      return;
    }
    if (pharmacistRequestCatalogProductIdBlocked(catalogProductId, displayRows, draft, catalogBlockRequestStatus)) {
      setError(pharmacistRequestCatalogProductBlockMessageFr(request?.status ?? null));
      return;
    }
    if (deferPersistOfficineAdditions) {
      setAltBusyRow(parentRow.id);
      const prefPrice = resolveCatalogPrice(catalogHitToPricingInput(pick));
      let validationError: string | null = null;
      let added = false;
      let addedLocalAltId: string | null = null;
      flushSync(() => {
        setPendingAlternatives((prev) => {
          const mergedExisting: AltRowDb[] = [
            ...normalizeAlts(parentRow.request_item_alternatives),
            ...pendingAltsAsRankedDb(prev, parentRow.id),
          ];
          if (mergedExisting.some((a) => a.product_id === catalogProductId)) {
            validationError = "Cette alternative figure déjà sur cette ligne.";
            return prev;
          }
          const rank = nextAltRank(mergedExisting);
          if (rank == null) {
            validationError = "Maximum 3 alternatives par ligne.";
            return prev;
          }
          added = true;
          const localAltId = newLocalAltId();
          addedLocalAltId = localAltId;
          return [
            ...prev,
            {
              localAltId,
              parentItemId: parentRow.id,
              rank,
              product_id: catalogProductId,
              availability_status: "available",
              available_qty: Math.max(1, parentRow.requested_qty),
              pharmacist_comment: null,
              unit_price: prefPrice,
              expected_availability_date: null,
              products: {
                name: pick.name,
                price_pph: pick.price_pph ?? null,
                photo_url: pick.photo_url ?? null,
              },
            },
          ];
        });
      });
      setAltBusyRow(null);
      if (validationError) {
        setError(validationError);
        return;
      }
      if (added) {
        clearAltPickerSearch();
        setAltRowsOpen((prev) => ({ ...prev, [parentRow.id]: true }));
        if (addedLocalAltId) {
          setLineAltTabByRowId((t) => ({ ...t, [parentRow.id]: addedLocalAltId! }));
        }
      }
      return;
    }
    const existing = normalizeAlts(parentRow.request_item_alternatives);
    const rank = nextAltRank(existing);
    if (existing.some((a) => a.product_id === catalogProductId)) {
      setError("Cette alternative figure déjà sur cette ligne.");
      return;
    }
    if (rank == null) {
      setError("Maximum 3 alternatives par ligne.");
      return;
    }
    setAltBusyRow(parentRow.id);
    const prefPrice = resolveCatalogPrice(catalogHitToPricingInput(pick));
    const { error: insErr } = await supabase.from("request_item_alternatives").insert({
      request_item_id: parentRow.id,
      rank,
      product_id: catalogProductId,
      availability_status: "available",
      available_qty: Math.max(1, parentRow.requested_qty),
      pharmacist_comment: null,
      unit_price: prefPrice,
      expected_availability_date: null,
    });
    setAltBusyRow(null);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    clearAltPickerSearch();
    setAltRowsOpen((prev) => ({ ...prev, [parentRow.id]: true }));

    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_added");
      if (h) {
        setError(h.message);
        return;
      }
    }

    const { data: altRows, error: fetchErr } = await supabase
      .from("request_item_alternatives")
      .select(
        "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url,full_description)"
      )
      .eq("request_item_id", parentRow.id)
      .order("rank", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }

    const lastAlt = (altRows ?? [])[((altRows ?? []).length) - 1] as { id?: string } | undefined;
    setItems((prev) =>
      prev.map((r) =>
        r.id === parentRow.id
          ? mapRequestItemRowPhotos({ ...r, request_item_alternatives: altRows ?? [] })
          : r
      )
    );
    if (lastAlt?.id) {
      setLineAltTabByRowId((t) => ({ ...t, [parentRow.id]: lastAlt.id! }));
    }
  };

  const flushPendingAlternativeDeletes = async (altIds: string[]) => {
    if (!id || altIds.length === 0) return;
    for (const altId of altIds) {
      const { error: delErr } = await supabase.from("request_item_alternatives").delete().eq("id", altId);
      if (delErr) throw new Error(delErr.message);
      if (request?.status === "confirmed") {
        const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_removed");
        if (h) throw new Error(h.message);
      }
    }
  };

  const deleteAlternativeRow = async (altId: string, parentRowId?: string) => {
    setError("");
    if (deferPersistOfficineAdditions && isLocalAltId(altId)) {
      setPendingAlternatives((prev) => prev.filter((a) => a.localAltId !== altId));
      if (altPickerOpenFor === parentRowId) resetAltPicker(parentRowId);
      return;
    }
    if (deferPersistOfficineAdditions) {
      setPendingDeletedAlternativeIds((prev) => (prev.includes(altId) ? prev : [...prev, altId]));
      setAltQtyDrafts((prev) => {
        const next = { ...prev };
        delete next[altId];
        return next;
      });
      if (parentRowId) {
        setLineAltTabByRowId((t) => (t[parentRowId] === altId ? { ...t, [parentRowId]: "principal" } : t));
      }
      if (altPickerOpenFor === parentRowId) resetAltPicker(parentRowId);
      return;
    }
    setAltBusyRow(altId);
    const { error: delErr } = await supabase.from("request_item_alternatives").delete().eq("id", altId);
    setAltBusyRow(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    if (request?.status === "confirmed") {
      const { error: h } = await logHistory(id, "confirmed", "confirmed", "counter_alternative_removed");
      if (h) {
        setError(h.message);
        return;
      }
    }
    if (altPickerOpenFor === parentRowId) resetAltPicker(parentRowId);

    if (parentRowId) {
      setLineAltTabByRowId((t) => (t[parentRowId] === altId ? { ...t, [parentRowId]: "principal" } : t));
      const { data: altRows, error: fetchErr } = await supabase
        .from("request_item_alternatives")
        .select(
          "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,product_type,price_pph,price_ppv,laboratory,photo_url,full_description)"
        )
        .eq("request_item_id", parentRowId)
        .order("rank", { ascending: true });
      if (!fetchErr) {
        setItems((prev) =>
          prev.map((r) =>
            r.id === parentRowId
              ? mapRequestItemRowPhotos({ ...r, request_item_alternatives: altRows ?? [] })
              : r
          )
        );
      }
    }
  };

  /** Écrit en base les propositions / alternatives tenues en mémoire locale (flux avant `confirmed`). */
  const flushDeferredOfficineAdds = async (
    draftSnap: Draft,
    proposalSnap: ItemRow[],
    altSnap: PendingAlternativeEntry[],
    opts?: {
      recordAddsAfterConfirm?: { requestId: string; channel: string; motive: string };
    }
  ): Promise<Map<string, string>> => {
    if (!id) throw new Error("Requête invalide.");
    if (proposalSnap.length === 0 && altSnap.length === 0) return new Map();

    const proposedIdMap = new Map<string, string>();

    for (const row of proposalSnap) {
      const f = draftSnap[row.id];
      if (!f?.availability_status) {
        throw new Error("Choisis une disponibilité pour chaque ligne.");
      }
      const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
      if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
        throw new Error("Prix unitaire invalide.");
      }

      const isDeferredOrdonnanceLine =
        request?.request_type === "prescription" && row.line_source === "patient_request";

      if (isDeferredOrdonnanceLine) {
        const requestedQty = ordonnanceDraftRequestedQty(row, f);
        const availQtyRaw = Number(f.available_qty);
        if (Number.isNaN(availQtyRaw) || availQtyRaw < 0) {
          throw new Error("Quantité disponible invalide sur une ligne ordonnance.");
        }
        const availableQty = ordonnanceInsertAvailableQty(f.availability_status, requestedQty, availQtyRaw);
        const inferredStatus = inferOrdonnanceLineAvailabilityStatus(
          f.availability_status,
          requestedQty,
          availableQty
        );
        if (inferredStatus === "to_order" && !(f.expected_availability_date ?? "").trim()) {
          throw new Error(
            `« ${one(row.products)?.name ?? "Produit"} » : date de réception prévue obligatoire pour un produit à commander.`
          );
        }
        if (inferredStatus === "to_order") {
          assertReceptionDateNotBeforeToday(f.expected_availability_date, one(row.products)?.name ?? undefined);
        }

        const { data: inserted, error: insErr } = await supabase
          .from("request_items")
          .insert({
            request_id: id,
            product_id: row.product_id,
            requested_qty: requestedQty,
            line_source: "patient_request",
            pharmacist_proposal_reason: null,
            is_selected_by_patient: true,
            selected_qty: requestedQty,
            counter_outcome: "unset",
            availability_status: inferredStatus,
            available_qty: availableQty,
            unit_price: price,
            pharmacist_comment: f.pharmacist_comment.trim() || null,
            expected_availability_date:
              f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
          })
          .select("id")
          .single();

        if (insErr || !inserted?.id) {
          throw new Error(insErr?.message ?? "Échec de l'enregistrement d'une ligne ordonnance.");
        }
        proposedIdMap.set(row.id, inserted.id);

        const recOrd = opts?.recordAddsAfterConfirm;
        if (recOrd) {
          if (!recOrd.channel.trim()) {
            throw new Error("Canal d’accord patient requis pour enregistrer les ajouts.");
          }
          const nmOrd = one(row.products)?.name ?? "Produit";
          const amendmentsOrd: SupplyAmendmentEntryJson[] = [
            buildLineAddedAfterConfirmAmendment({
              requestItemId: inserted.id,
              productName: nmOrd,
              qty: requestedQty,
              mode: "ordonnance",
              channel: recOrd.channel,
              motive: recOrd.motive,
            }),
          ];
          const { error: rpcOrd } = await supabase.rpc("pharmacist_record_supply_amendments", {
            p_request_id: recOrd.requestId,
            p_amendments: amendmentsOrd,
          });
          if (rpcOrd) throw new Error(rpcOrd.message);
        }
        continue;
      }

      const availQtyRaw = Number(f.available_qty);
      if (Number.isNaN(availQtyRaw) || availQtyRaw < 1) {
        throw new Error("Pour chaque proposition officine, la dispo doit être au moins 1.");
      }
      const qtyLine = Math.min(
        PHARMACIST_PROPOSED_STOCK_CEILING,
        Math.max(1, Math.floor(availQtyRaw))
      );
      const inferredStatus = inferAvailabilityStatusFromQty({
        status: f.availability_status,
        availableQty: qtyLine,
        requestedQty: row.requested_qty,
        isProposedLine: row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id),
      });

      if (
        opts?.recordAddsAfterConfirm &&
        inferredStatus === "to_order" &&
        (f.expected_availability_date ?? "").trim() === ""
      ) {
        throw new Error(
          "Pour chaque ajout « à commander », indiquez la date prévisionnelle de réception avant d’enregistrer le dossier."
        );
      }
      if (inferredStatus === "to_order") {
        assertReceptionDateNotBeforeToday(f.expected_availability_date, one(row.products)?.name ?? undefined);
      }

      const insertPcfTreated =
        opts?.recordAddsAfterConfirm && request?.status === "treated"
          ? inferredStatus === "available" || inferredStatus === "partially_available"
            ? ("reserved" as const)
            : inferredStatus === "to_order"
              ? ("ordered" as const)
              : null
          : null;

      const { data: inserted, error: insErr } = await supabase
        .from("request_items")
        .insert({
          request_id: id,
          product_id: row.product_id,
          requested_qty: qtyLine,
          line_source: "pharmacist_proposed",
          pharmacist_proposal_reason: row.pharmacist_proposal_reason,
          is_selected_by_patient: true,
          selected_qty: qtyLine,
          counter_outcome: "unset",
          availability_status: inferredStatus,
          available_qty: qtyLine,
          unit_price: price,
          pharmacist_comment: f.pharmacist_comment.trim() || null,
          expected_availability_date:
            f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
          ...(insertPcfTreated != null ? { post_confirm_fulfillment: insertPcfTreated } : {}),
        })
        .select("id")
        .single();

      if (insErr || !inserted?.id) {
        throw new Error(insErr?.message ?? "Échec de l'enregistrement d'une proposition.");
      }
      proposedIdMap.set(row.id, inserted.id);

      const rec = opts?.recordAddsAfterConfirm;
      if (rec) {
        if (!rec.channel.trim()) {
          throw new Error("Canal d’accord patient requis pour enregistrer les ajouts.");
        }
        const nm = validatedProductLabel(row as PatientLineLike);
        const amendments: SupplyAmendmentEntryJson[] = [
          buildLineAddedAfterConfirmAmendment({
            requestItemId: inserted.id,
            productName: nm,
            qty: qtyLine,
            mode: "proposed",
            channel: rec.channel,
            motive: rec.motive,
          }),
        ];
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: rec.requestId,
          p_amendments: amendments,
        });
        if (rpcA) throw new Error(rpcA.message);
      }
    }

    for (const p of altSnap) {
      const parentResolved = isLocalProposedItemId(p.parentItemId)
        ? proposedIdMap.get(p.parentItemId)
        : p.parentItemId;
      if (!parentResolved) {
        throw new Error("Référence de ligne invalide pour une alternative.");
      }
      const { error: altErr } = await supabase.from("request_item_alternatives").insert({
        request_item_id: parentResolved,
        rank: p.rank,
        product_id: p.product_id,
        availability_status: p.availability_status,
        available_qty: p.available_qty,
        pharmacist_comment: p.pharmacist_comment,
        unit_price: p.unit_price,
        expected_availability_date: p.expected_availability_date,
      });
      if (altErr) throw new Error(altErr.message);
    }
    return proposedIdMap;
  };

  const saveCounterOutcome = async (
    requestItemId: string,
    outcome: string,
    cancelReason: string | null = null,
    cancelDetail: string | null = null
  ) => {
    const rowSnap = items.find((r) => r.id === requestItemId);
    const prevCo = rowSnap?.counter_outcome ?? "unset";
    const prevCancelReason = rowSnap?.counter_cancel_reason ?? null;
    const prevCancelDetail = rowSnap?.counter_cancel_detail ?? null;
    if (
      prevCo === outcome &&
      (outcome !== "cancelled_at_counter" ||
        ((prevCancelReason ?? null) === (cancelReason ?? null) &&
          (prevCancelDetail ?? null) === (cancelDetail ?? null)))
    ) {
      return;
    }
    const shouldResetPrepQtyAfterDropPickup =
      request?.status === "confirmed" &&
      Boolean(rowSnap?.is_selected_by_patient) &&
      prevCo === "picked_up" &&
      outcome !== "picked_up";

    setCounterBusyId(requestItemId);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
      p_request_item_id: requestItemId,
      p_outcome: outcome,
      p_cancel_reason: outcome === "cancelled_at_counter" ? cancelReason : null,
      p_cancel_detail: outcome === "cancelled_at_counter" ? cancelDetail : null,
    });
    setCounterBusyId(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setDraft((prev) => {
      const cur = prev[requestItemId];
      if (!cur) return prev;
      return {
        ...prev,
        [requestItemId]: {
          ...cur,
          counter_outcome_draft: outcome,
          counter_cancel_reason_draft: outcome === "cancelled_at_counter" ? cancelReason : null,
          counter_cancel_detail_draft: outcome === "cancelled_at_counter" ? cancelDetail : null,
        },
      };
    });
    if (shouldResetPrepQtyAfterDropPickup && rowSnap) {
      const baseline = Math.min(
        PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
        Math.max(1, Number(rowSnap.selected_qty ?? rowSnap.requested_qty) || 1)
      );
      setField(requestItemId, "available_qty", String(baseline));
    }
    const st = request?.status;
    if (st === "confirmed" || st === "treated") {
      const counterProductName = rowSnap
        ? validatedProductLabel(rowSnap as PatientLineLike)
        : "Produit";
      const reasonStr = formatCounterOutcomeHistoryReason(outcome, counterProductName, cancelReason);
      const { error: h } = await logHistory(id, st, st, reasonStr);
      if (h) {
        setError(h.message);
        return;
      }
    }
    const hasPendingSupplyEdits = computeSupplyStructuralDirty(
      request,
      items,
      draft,
      pendingProposalRows,
      pendingAlternatives,
      altQtyDrafts,
      removedPersistedProposedIds,
      pendingDeletedAlternativeIds
    );
    if (hasPendingSupplyEdits) {
      setItems((prev) =>
        prev.map((r) =>
          r.id === requestItemId
            ? {
                ...r,
                counter_outcome: outcome,
                counter_cancel_reason: outcome === "cancelled_at_counter" ? cancelReason : null,
                counter_cancel_detail: outcome === "cancelled_at_counter" ? cancelDetail : null,
              }
            : r
        )
      );
      dispatchRequestDetailRefresh(id);
      return;
    }
    await load();
  };

  const declareTreatedSummary = useMemo(() => {
    if (!request) {
      return { reservedLines: [], orderedLines: [], otherLines: [] };
    }
    return buildPharmacistDeclareTreatedSummary(items, draft, request.request_type);
  }, [request, items, draft]);

  const runDeclareRequestTreated = async () => {
    if (!id) return;
    setDeclareTreatedBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_mark_request_treated", {
      p_request_id: id,
      p_expected_updated_at: request?.updated_at ?? null,
    });
    setDeclareTreatedBusy(false);
    if (rpcErr) {
      const raw = rpcErr.message ?? "";
      setError(
        /only product_request/i.test(raw)
          ? "Impossible de déclarer traitée pour une ordonnance tant que la mise à jour Supabase du pilote n’est pas appliquée (20260703_002)."
          : raw
      );
      return;
    }
    setDeclareTreatedModalOpen(false);
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const saveConfirmedAdjustmentsCore = async (work: {
    items: ItemRow[];
    draft: Draft;
    globalChannel: string;
    globalMotive: string;
    removedProposedIds?: string[];
    /** Ajouts flushés juste avant : journalisés dans le même RPC que le reste. */
    lineAddedAmends?: SupplyAmendmentEntryJson[];
  }) => {
    if (!request || !["confirmed", "treated"].includes(request.status) || !id) return;
    const rows = work.items;
    const d = work.draft;
    const globalChannel = work.globalChannel.trim();
    const globalMotive = work.globalMotive.trim();
    const removedIds = work.removedProposedIds ?? [];
    setBusy(true);
    setError("");
    try {
      for (const row of rows) {
        const f = d[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const qtyPrep = Number(f.available_qty);
        if (Number.isNaN(qtyPrep) || qtyPrep < 0) throw new Error("Quantité disponible invalide sur une ligne.");
        const nm = validatedProductLabel(row as PatientLineLike);
        const isAjoutOfficine =
          request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
        if (isAjoutOfficine && qtyPrep < 1 && !f.withdrawn_after_confirm) {
          throw new Error(`« ${nm} » (proposition officine) : dispo minimale 1.`);
        }
        const validatedQtySave = draftValidatedQtyForSave(f, row);
        const fForPayload: ItemDraft = { ...f, available_qty: String(validatedQtySave) };
        const payload = buildRequestItemUpdatePayloadForPharmacistSave(
          fForPayload,
          row,
          request.request_type,
          request.status
        );
        const inf = inferredAvailabilityForPostConfirmClamp(row, payload.availability_status);
        if (!f.withdrawn_after_confirm && inf === "to_order") {
          const eta = effectiveEtaSupplyDraft(row, f, request.request_type, request.status);
          if (!eta || !eta.trim()) {
            throw new Error(
              `« ${nm} » : renseignez la date prévisionnelle de réception pour toute ligne « à commander » avant d’enregistrer.`
            );
          }
        }
      }

      const allAmends = [
        ...buildConfirmedSupplyAmendmentBatch(
          rows,
          d,
          request.request_type,
          globalChannel,
          globalMotive,
          removedIds
        ),
        ...(work.lineAddedAmends ?? []),
      ];
      assertSupplyAmendmentChannels(allAmends);
      if (allAmends.length > 0) {
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: id,
          p_amendments: allAmends,
        });
        if (rpcA) throw new Error(rpcA.message);
      }

      for (const row of rows) {
        const f = d[row.id];
        if (!f?.availability_status) continue;
        const validatedQtySave = draftValidatedQtyForSave(f, row);
        const fForPayload: ItemDraft = { ...f, available_qty: String(validatedQtySave) };
        const payload = buildRequestItemUpdatePayloadForPharmacistSave(
          fForPayload,
          row,
          request.request_type,
          request.status
        );
        const nextSelectedQty =
          row.is_selected_by_patient && !f.withdrawn_after_confirm
            ? validatedQtySave
            : row.selected_qty;
        payload.available_qty = validatedQtySave;
        const inf = inferredAvailabilityForPostConfirmClamp(row, payload.availability_status);
        let pcf: "unset" | "reserved" | "ordered" | "arrived_reserved" = f.fulfillment_draft;
        if (f.withdrawn_after_confirm) {
          pcf = "unset";
        } else {
          pcf = clampFulfillmentDraftToInferred(pcf, inf);
        }
        const pcfDb: "unset" | "reserved" | "ordered" | "arrived_reserved" = pcf;
        const { error: up } = await supabase
          .from("request_items")
          .update({
            ...payload,
            post_confirm_fulfillment: pcfDb,
            withdrawn_after_confirm: Boolean(f.withdrawn_after_confirm),
            selected_qty: nextSelectedQty,
          })
          .eq("id", row.id);
        if (up) throw new Error(up.message);

        const chosenPatchId = row.patient_chosen_alternative_id;
        if (chosenPatchId && !f.withdrawn_after_confirm) {
          const chosenAltRow = normalizeAlts(row.request_item_alternatives).find((a) => a.id === chosenPatchId);
          const { error: altUpd } = await supabase
            .from("request_item_alternatives")
            .update({
              availability_status: payload.availability_status,
              available_qty: payload.available_qty,
              unit_price: payload.unit_price,
              pharmacist_comment: payload.pharmacist_comment ?? chosenAltRow?.pharmacist_comment ?? null,
              expected_availability_date: payload.expected_availability_date,
            })
            .eq("id", chosenPatchId)
            .eq("request_item_id", row.id);
          if (altUpd) throw new Error(altUpd.message);
        }
      }

      for (const rowId of removedIds) {
        const row = rows.find((r) => r.id === rowId);
        if (!row || row.line_source !== "pharmacist_proposed") continue;
        const { error: delErr } = await supabase
          .from("request_items")
          .delete()
          .eq("id", row.id)
          .eq("line_source", "pharmacist_proposed");
        if (delErr) throw new Error(delErr.message);
      }

      for (const row of rows) {
        const f = d[row.id];
        if (!f) continue;
        const wasWithdrawn = Boolean(row.withdrawn_after_confirm);
        const nextWithdrawn = Boolean(f.withdrawn_after_confirm);
        if (!wasWithdrawn && nextWithdrawn && row.is_selected_by_patient) {
          const curCo = row.counter_outcome ?? "unset";
          if (curCo !== "unset") {
            const { error: rpcW } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
              p_request_item_id: row.id,
              p_outcome: "unset",
              p_cancel_reason: null,
              p_cancel_detail: null,
            });
            if (rpcW) throw new Error(rpcW.message);
          }
        }
        const normalized = normalizeCounterOutcomeForPersist(row, f);
        if (normalized === null) continue;
        const nextCo = normalized.outcome;
        const nextReason = normalized.cancelReason;
        const nextDetail = normalized.cancelDetail;
        const curCo = row.counter_outcome ?? "unset";
        const curReason = row.counter_cancel_reason ?? null;
        const curDetail = row.counter_cancel_detail ?? null;
        if (nextCo === curCo && (nextReason ?? null) === (curReason ?? null) && (nextDetail ?? null) === (curDetail ?? null)) {
          continue;
        }
        const { error: rpcCo } = await supabase.rpc("pharmacist_set_item_counter_outcome", {
          p_request_item_id: row.id,
          p_outcome: nextCo,
          p_cancel_reason: nextReason,
          p_cancel_detail: nextDetail,
        });
        if (rpcCo) throw new Error(rpcCo.message);
      }

      const audit = buildPharmaConfirmAdjustmentAudit(rows, d);
      const historyLoggedByAmendmentRpc = allAmends.some((a) => a.kind === "line_added_after_confirm");
      if (!historyLoggedByAmendmentRpc) {
        const histReason = audit ? stringifyPharmaConfirmAudit(audit) : "pharmacist_adjustments_after_confirmation";
        const { error: h } = await logHistory(id, request.status, request.status, histReason);
        if (h) throw new Error(h.message);
      }

      dispatchRequestDetailRefresh(id);
      freshDraftAfterSaveRef.current = true;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const startSaveConfirmedAdjustments = () => {
    if (!request || !["confirmed", "treated"].includes(request.status)) return;
    if (!supplyStructuralDirty) {
      setError("");
      return;
    }
    for (const row of items) {
      const fd = draft[row.id];
      if (!fd || !row.is_selected_by_patient) continue;
      if (row.withdrawn_after_confirm && !fd.withdrawn_after_confirm) {
        setError(
          "Une ligne déjà retirée et enregistrée ne peut pas être réintégrée depuis cet écran. Ajoutez le produit à nouveau si besoin."
        );
        return;
      }
    }
    setError("");
    setSupplySaveGlobalChannel("");
    setSupplySaveGlobalMotive("");
    const summaryLines = buildConfirmedSupplySaveSummaryLines(
      items,
      draft,
      pendingProposalRows,
      pendingAlternatives,
      altQtyDrafts,
      request?.status ?? null,
      request?.request_type ?? "product_request",
      proposedBadgeLabel,
      removedPersistedProposedIds,
      pendingDeletedAlternativeIds
    );
    setSupplySaveConfirmLines(
      summaryLines.length > 0
        ? summaryLines
        : ["Aucun détail supplémentaire : enregistrement des brouillons et du journal patient."]
    );
    setSupplySaveConfirmNeedsChannel(
      confirmedSupplySaveNeedsPatientChannel(
        items,
        draft,
        request.request_type,
        pendingProposalRows.filter((r) => isLocalProposedItemId(r.id)),
        removedPersistedProposedIds
      )
    );
    setSupplySaveConfirmOpen(true);
  };

  const executeConfirmedSupplySave = async () => {
    if (!request || !id) return;
    const channel = supplySaveGlobalChannel.trim();
    const motive = supplySaveGlobalMotive.trim();
    const proposalSnapLocal = pendingProposalRows.filter((r) => isLocalProposedItemId(r.id));
    const altSnap = [...pendingAlternatives];
    const removedSnap = [...removedPersistedProposedIds];
    const deletedAltSnap = [...pendingDeletedAlternativeIds];
    const needsAmendJournal = confirmedSupplySaveNeedsPatientChannel(
      items,
      draft,
      request.request_type,
      proposalSnapLocal,
      removedSnap
    );
    if (needsAmendJournal && !channel) {
      setError("Indiquez le canal d’accord patient pour l’ensemble des modifications.");
      return;
    }
    for (const row of items) {
      const fd = draft[row.id];
      if (!fd || !row.is_selected_by_patient) continue;
      if (row.withdrawn_after_confirm && !fd.withdrawn_after_confirm) {
        setError(
          "Une ligne déjà retirée et enregistrée ne peut pas être réintégrée depuis cet écran. Ajoutez le produit à nouveau si besoin."
        );
        setSupplySaveConfirmOpen(false);
        setSupplySaveConfirmLines([]);
        return;
      }
    }
    try {
      let workItems = [...items];
      let workDraft: Draft = { ...draft };

      let lineAddedAmends: SupplyAmendmentEntryJson[] = [];

      await flushPendingAlternativeDeletes(deletedAltSnap);
      if (deletedAltSnap.length > 0) {
        const { data: freshAfterAltDel, error: altDelErr } = await supabase
          .from("request_items")
          .select(PHARMA_REQUEST_ITEMS_SELECT)
          .eq("request_id", id)
          .order("created_at", { ascending: true });
        if (altDelErr) throw new Error(altDelErr.message);
        workItems = (freshAfterAltDel as ItemRow[]) ?? [];
        workDraft = mergeDraftAfterLocalProposalFlush(
          workItems,
          workDraft,
          new Map(),
          request?.status ?? null
        );
      }

      if (proposalSnapLocal.length > 0) {
        const idMap = await flushDeferredOfficineAdds(workDraft, proposalSnapLocal, altSnap);
        const { data: freshData, error: freshErr } = await supabase
          .from("request_items")
          .select(PHARMA_REQUEST_ITEMS_SELECT)
          .eq("request_id", id)
          .order("created_at", { ascending: true });
        if (freshErr) throw new Error(freshErr.message);
        workItems = (freshData as ItemRow[]) ?? [];
        workDraft = mergeDraftAfterLocalProposalFlush(workItems, workDraft, idMap, request?.status ?? null);
        if (needsAmendJournal) {
          lineAddedAmends = buildLineAddedAmendmentsFromProposalFlush(
            proposalSnapLocal,
            workItems,
            idMap,
            request.request_type,
            channel,
            motive
          );
        }
      }

      workDraft = mergeChosenAltQtyDraftsIntoWorkDraft(workItems, workDraft, altQtyDrafts);

      await saveConfirmedAdjustmentsCore({
        items: workItems,
        draft: workDraft,
        globalChannel: channel,
        globalMotive: motive,
        removedProposedIds: removedSnap,
        lineAddedAmends,
      });

      setPendingProposalRows([]);
      setPendingAlternatives([]);
      setPendingDeletedAlternativeIds([]);

      let activeRetained = 0;
      let pickedUpAfter = 0;
      for (const row of workItems) {
        if (!row.is_selected_by_patient) continue;
        const fd = workDraft[row.id];
        const withdrawn =
          Boolean(row.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
        if (!withdrawn) activeRetained += 1;
        if ((row.counter_outcome ?? "unset") === "picked_up") pickedUpAfter += 1;
      }
      const willAbandon = activeRetained === 0 && pickedUpAfter < 1;
      if (willAbandon) {
        const { error: abErr } = await supabase.rpc("pharmacist_abandon_request_no_pickup", {
          p_request_id: id,
        });
        if (abErr) throw new Error(abErr.message);
      }

      setSupplyEditOpenRowIds({});
      setRemovedPersistedProposedIds([]);
      setSupplySaveGlobalChannel("");
      setSupplySaveGlobalMotive("");
      setSupplySaveConfirmOpen(false);
      setSupplySaveConfirmLines([]);
      setAltQtyDrafts({});
      setSupplyEditOpenRowIds({});
    } catch {
      /* setError dans saveConfirmedAdjustmentsCore */
      await load();
    }
  };

  const saveRespondedAdjustments = async () => {
    if (!request || request.status !== "responded") return;
    setBusy(true);
    setError("");
    const draftSnap = draft;
    const proposalSnap = [...pendingProposalRows];
    const altSnap = [...pendingAlternatives];
    const deletedAltSnap = [...pendingDeletedAlternativeIds];
    const altDraftSnap = { ...altQtyDrafts };
    const removedSnap = [...removedPersistedRespondedEditIds];
    try {
      await flushPendingAlternativeDeletes(deletedAltSnap);
      for (const rid of removedSnap) {
        const { error: delErr } = await supabase.from("request_items").delete().eq("id", rid);
        if (delErr) throw new Error(delErr.message);
      }
      for (const row of displayRows) {
        if (isLocalProposedItemId(row.id)) continue;
        if (removedSnap.includes(row.id)) continue;
        const f = draftSnap[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const { error: up } = await supabase
          .from("request_items")
          .update(
            buildRequestItemUpdatePayloadForPharmacistSave(f, row, request.request_type, request.status)
          )
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }
      await persistAlternativeQtyUpdates(displayRows, altDraftSnap);
      await flushDeferredOfficineAdds(draftSnap, proposalSnap, altSnap);
      const { error: touchErr } = await supabase
        .from("requests")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", id);
      if (touchErr) throw new Error(touchErr.message);
      setPendingProposalRows([]);
      setPendingAlternatives([]);
      setPendingDeletedAlternativeIds([]);
      setRemovedPersistedRespondedEditIds([]);
      const { error: h } = await logHistory(id, "responded", "responded", "pharmacist_response_updated");
      if (h) throw new Error(h.message);
      dispatchRequestDetailRefresh(id);
      setRespondedEditMode(false);
      resetRespondedLineAltUi();
      setRespondedSaveConfirmOpen(false);
      setRespondedSaveDiffLines([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setBusy(false);
  };

  const publishResponse = async () => {
    if (!request) return;
    if (
      request.request_type !== "product_request" &&
      request.request_type !== "prescription" &&
      request.request_type !== "free_consultation"
    ) {
      setError("Type de demande non pris en charge sur cet écran.");
      return;
    }
    if (displayRows.length === 0) {
      setError(getRequestKindWorkflowCopy(request.request_type).pharmacistPublishNeedLinesError);
      return;
    }

    for (const row of displayRows) {
      const f = draft[row.id];
      if (!f?.availability_status) {
        setError("Choisis une disponibilité pour chaque ligne.");
        return;
      }
      const qty = Number(f.available_qty);
      if (Number.isNaN(qty) || qty < 0) {
        setError("Quantité disponible invalide sur une ligne.");
        return;
      }
      const isAjoutOfficine =
        request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
      const isOrdonnancePharma =
        request != null && isPrescriptionOrdonnancePharmacistLine(request.request_type, row);
      const isPrescriptionExtraProposed =
        request != null &&
        isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
      const reqQty = isOrdonnancePharma
        ? ordonnanceDraftRequestedQty(row, f)
        : row.requested_qty;
      const inferredPublish = inferredAvailabilityForPharmacistPublish(
        row,
        f,
        request.request_type,
        supplyAmendmentBundles
      );
      if (inferredPublish === "to_order" && !f.expected_availability_date.trim()) {
        const nm = validatedProductLabel(row as PatientLineLike);
        setError(`« ${nm} » : date de réception prévue obligatoire pour un produit à commander.`);
        return;
      }

      if (isAjoutOfficine || request.request_type === "free_consultation" || isPrescriptionExtraProposed) {
        if (qty < 1) {
          const nm = validatedProductLabel(row as PatientLineLike);
          setError(
            request.request_type === "free_consultation"
              ? `« ${nm} » : indiquez une quantité d’au moins 1.`
              : `« ${nm} » (proposition officine) : indiquez une dispo d’au moins 1.`
          );
          return;
        }
      } else if (qty > reqQty) {
        const nm = validatedProductLabel(row as PatientLineLike);
        setError(`« ${nm} » : la dispo ne peut pas dépasser la quantité demandée (${reqQty}).`);
        return;
      }
    }

    setBusy(true);
    setError("");

    let currentStatus = request.status;
    /** Pour `request_status_history` : doit refléter le statut réel avant passage à `responded`. */
    let oldStatusForRespondedTransition = currentStatus;

    const draftSnap = draft;
    const proposalSnap = [...pendingProposalRows];
    const altSnap = [...pendingAlternatives];
    const deletedAltSnap = [...pendingDeletedAlternativeIds];
    const altDraftSnap = { ...altQtyDrafts };
    const rowsForPublish = [...displayRows];

    try {
      await flushPendingAlternativeDeletes(deletedAltSnap);

      if (currentStatus === "submitted") {
        const { error: u1 } = await supabase.from("requests").update({ status: "in_review" }).eq("id", id);
        if (u1) throw new Error(u1.message);
        const { error: h1 } = await logHistory(id, "submitted", "in_review");
        if (h1) throw new Error(h1.message);
        currentStatus = "in_review";
        oldStatusForRespondedTransition = "in_review";
        setRequest((prev) => (prev && prev.id === id ? { ...prev, status: "in_review" } : prev));
      }

      if (currentStatus !== "in_review") {
        throw new Error(
          `Impossible d’envoyer la réponse (statut : ${request.status}). Réouvrez la demande ou contactez le support si le problème persiste.`
        );
      }

      for (const row of displayRows) {
        if (isLocalProposedItemId(row.id)) continue;
        const f = draftSnap[row.id]!;
        if (f.unit_price.trim() !== "") {
          const price = Number(f.unit_price.replace(",", "."));
          if (price == null || Number.isNaN(price) || price < 0) {
            throw new Error("Prix unitaire invalide.");
          }
        }
        let payload: ReturnType<typeof buildRequestItemUpdatePayloadForPharmacistSave>;
        try {
          payload = buildRequestItemUpdatePayloadForPharmacistSave(
            f,
            row,
            request.request_type,
            request.status
          );
        } catch (e) {
          throw new Error(e instanceof Error ? e.message : "Données ligne invalides.");
        }

        const { error: up } = await supabase.from("request_items").update(payload).eq("id", row.id);

        if (up) throw new Error(up.message);
      }

      await persistAlternativeQtyUpdates(rowsForPublish, altDraftSnap);

      await flushDeferredOfficineAdds(draftSnap, proposalSnap, altSnap);
      setPendingProposalRows([]);
      setPendingAlternatives([]);
      setPendingDeletedAlternativeIds([]);

      /* Pilote Q38/Q6 : pas d’expiration +7 j après réponse ; l’état passe par abandon 24 h (cron) après `responded` si aucune confirmation. */
      const { error: u2 } = await supabase
        .from("requests")
        .update({
          status: "responded",
          responded_at: new Date().toISOString(),
          expires_at: null,
        })
        .eq("id", id);

      if (u2) throw new Error(u2.message);

      const { error: h2 } = await logHistory(
        id,
        oldStatusForRespondedTransition,
        "responded",
        "publication_disponibilites"
      );
      if (h2) throw new Error(h2.message);
      setError("");
      setRespondedEditMode(false);
      resetRespondedLineAltUi();
      if (request.request_type === "free_consultation") {
        setConsultationTab("products");
      }
      await load();
      dispatchRequestDetailRefresh(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const runPharmacistCancelRequest = async (motif: string) => {
    if (!id) return;
    const m = motif.trim();
    if (m.length < 5) {
      setError("Précisez un motif d'annulation d'au moins 5 caractères.");
      return;
    }
    setCancelBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_cancel_request", {
      p_request_id: id,
      p_reason_text: m,
    });
    setCancelBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setCancelModalOpen(false);
    await load();
  };

  const loadHistory = useCallback(async () => {
    if (!id) return;
    setHistoryBusy(true);
    const { data, error: histErr } = await supabase
      .from("request_status_history")
      .select("id,created_at,old_status,new_status,reason")
      .eq("request_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (!histErr && Array.isArray(data)) {
      setHistoryRows(data as typeof historyRows);
    }
    setHistoryBusy(false);
  }, [id]);

  const closeRequestSummary = useMemo((): PharmacistCloseRequestSummary | null => {
    if (!request || request.status !== "treated") return null;
    const selectedLines = items.filter((i) => i.is_selected_by_patient);
    const tracked = selectedLines.filter((i) => !i.withdrawn_after_confirm);
    const pickedUpCount = tracked.filter((i) => (i.counter_outcome ?? "unset") === "picked_up").length;
    const pendingPickupCount = tracked.filter((i) => (i.counter_outcome ?? "unset") !== "picked_up").length;
    return {
      totalLines: items.length,
      retainedCount: selectedLines.length,
      notRetainedAtValidation: items.filter((i) => !i.is_selected_by_patient).length,
      withdrawnAfterConfirm: items.filter((i) => i.is_selected_by_patient && i.withdrawn_after_confirm).length,
      pickedUpCount,
      pendingPickupCount,
      hasPartialPickupWarning: pendingPickupCount > 0,
    };
  }, [items, request]);

  const runCompleteAfterCounter = async () => {
    if (!id || !request) return;
    if (request.status !== "treated") return;
    setCompleteBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_complete_request_after_counter", {
      p_request_id: id,
      p_reason: "pharmacist_ui_confirm_close",
    });
    setCompleteBusy(false);
    setCloseConfirmOpen(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    await load();
  };

  const archiveFrozen =
    request != null &&
    (pharmacistRequestIsHardStopped(request.status) || pharmacistRequestIsClosedSuccess(request.status));
  const uiRequestStatus =
    request && archiveFrozen
      ? inferArchiveSnapshotStatus(request.status, {
          responded_at: request.responded_at,
          confirmed_at: request.confirmed_at,
          items,
        })
      : request?.status;
  const canEditResponse = request && ["submitted", "in_review"].includes(uiRequestStatus ?? "");
  const canManageSupply =
    request && ["confirmed", "treated"].includes(uiRequestStatus ?? "") && !archiveFrozen;
  const canManageResponded = uiRequestStatus === "responded" && !archiveFrozen;
  const respondedFrozenView = Boolean(request?.status === "responded" && !respondedEditMode);
  const showLineAndPublishEdits =
    !!request &&
    !archiveFrozen &&
    (["submitted", "in_review"].includes(uiRequestStatus ?? "") ||
      (uiRequestStatus === "responded" && respondedEditMode) ||
      ["confirmed", "treated"].includes(uiRequestStatus ?? ""));
  /** Notes patient / officine par ligne : réponse ou modification de réponse uniquement (pas en supply post-validé). */
  const canEditLineProductNotes = pharmacistCanEditLineProductNotes(uiRequestStatus ?? null, {
    respondedEditMode,
    archiveFrozen,
  });
  const usesLineWorkflow = requestUsesProductLineWorkflow(request?.request_type);
  const showArchiveFrozenProducts = Boolean(
    request &&
      usesLineWorkflow &&
      archiveFrozen &&
      !pharmacistRequestIsClosedSuccess(request.status)
  );
  const archiveSel = useMemo(() => {
    if (!showArchiveFrozenProducts) return {};
    if (uiRequestStatus === "confirmed" || uiRequestStatus === "treated") {
      return computeSelFromConfirmedItems(displayRows);
    }
    return computeSelFromItems(displayRows);
  }, [showArchiveFrozenProducts, uiRequestStatus, displayRows]);
  const isPrescription = request?.request_type === "prescription";
  const isConsultation = request?.request_type === "free_consultation";
  const ordonnanceCatalogEditable = isPrescription && showLineAndPublishEdits;
  /* Pas de useMemo : `draft` est muté en place — react-hooks/preserve-manual-memoization (React Compiler). */
  const lineEntriesForList =
    request && ["confirmed", "treated"].includes(uiRequestStatus ?? "")
      ? (() => {
          const eff = rowsWithEffectiveWithdrawnForSupply(displayRows, draft);
          const sorted = sortPharmacistSupplyRowsBySection(eff);
          const flat = flattenPharmacistSupplyListEntriesStable(sorted).filter(
            (e) => !removedPersistedProposedIds.includes(e.row.id)
          );
          const visibleRows = displayRows.filter((r) => !removedPersistedProposedIds.includes(r.id));
          return flat.length > 0 ? flat : visibleRows.map((row) => ({ header: null as string | null, row }));
        })()
      : displayRows.map((row) => ({ header: null as string | null, row }));

  const pharmacistSupplySurfaceGroups = useMemo(() => {
    type Entry = (typeof lineEntriesForList)[number];
    type Surface = "principal" | "secondary" | "neutral";
    if (!request || !["confirmed", "treated"].includes(request.status)) {
      return [{ surface: "neutral" as const, entries: lineEntriesForList as Entry[], bucketMeta: null as PharmacistValidatedBucketGroup<PatientLineLike> | null }];
    }
    const eff = rowsWithEffectiveWithdrawnForSupply(displayRows, draft).filter(
      (r) => !removedPersistedProposedIds.includes(r.id)
    );
    const forBuckets = eff.map((row) => rowForValidatedSupplyBucket(row, draft, request?.request_type ?? "product_request"));
    const sorted = sortPharmacistSupplyRowsBySection(forBuckets);
    const bucketGroups = buildPharmacistValidatedBucketGroups(
      sorted,
      request.status,
      pricingConfig
    );
    return bucketGroups.map((g) => ({
      surface: "neutral" as const,
      bucketMeta: g,
      entries: g.rows.map((row) => {
        const sourceRow = eff.find((r) => r.id === row.id) ?? (row as ItemRow);
        return { header: null as string | null, row: sourceRow as Entry["row"] };
      }),
    }));
  }, [request, lineEntriesForList, displayRows, draft, pricingConfig, removedPersistedProposedIds]);

  /* useMemo retiré : évite react-hooks/preserve-manual-memoization sur ce bloc (React Compiler). */
  const supplyStructuralDirty = computeSupplyStructuralDirty(
    request,
    items,
    draft,
    pendingProposalRows,
    pendingAlternatives,
    altQtyDrafts,
    removedPersistedProposedIds,
    pendingDeletedAlternativeIds
  );

  const supplyFooterTotals = useMemo(() => {
    let count = 0;
    let total = 0;
    let missingPrice = false;
    for (const row of displayRows) {
      if (!row.is_selected_by_patient) continue;
      const f = draft[row.id];
      const withdrawn = Boolean(f?.withdrawn_after_confirm) || Boolean(row.withdrawn_after_confirm);
      if (withdrawn) continue;
      count += 1;
      const pl = row as PatientLineLike;
      const q = validatedQtyForPatientLine(pl);
      const p = validatedBranchUnitPriceMad(pl);
      if (p != null) {
        total += p * q;
      } else {
        missingPrice = true;
      }
    }
    return { count, total, missingPrice };
  }, [displayRows, draft]);

  const lineConvoEffectiveRowId = useMemo(() => {
    if (!lineConvoRowId) return null;
    return lineEntriesForList.some((e) => e.row.id === lineConvoRowId) ? lineConvoRowId : null;
  }, [lineConvoRowId, lineEntriesForList]);

  useLayoutEffect(() => {
    if (respondedEditMode && request?.status === "responded" && !prevRespondedEditMode.current) {
      respondedEditBaselineRef.current = takeRespondedEditSnapshot(
        draft,
        altQtyDrafts,
        pendingProposalRows,
        pendingAlternatives,
        pendingDeletedAlternativeIds,
        removedPersistedRespondedEditIds
      );
    }
    if (!respondedEditMode) {
      respondedEditBaselineRef.current = null;
    }
    prevRespondedEditMode.current = respondedEditMode;
  }, [
    respondedEditMode,
    request?.status,
    draft,
    altQtyDrafts,
    pendingProposalRows,
    pendingAlternatives,
    pendingDeletedAlternativeIds,
    removedPersistedRespondedEditIds,
  ]);

  const publishConfirmGroups = useMemo(() => {
    const all: PublishConfirmRowMeta[] = [];
    for (const r of displayRows) {
      const fd = draft[r.id];
      if (!fd) continue;
      all.push(buildPublishConfirmRowMeta(r, fd, request?.request_type, supplyAmendmentBundles, pricingConfig));
    }
    return {
      ready: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "ready"),
      order: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "order"),
      blocked: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "blocked"),
    };
  }, [displayRows, draft, request?.request_type, supplyAmendmentBundles, pricingConfig]);

  const publishMissingReceptionDate = useMemo(() => {
    const names = pharmacistPublishMissingReceptionDateProductNames(
      displayRows,
      draft,
      request?.request_type,
      supplyAmendmentBundles
    );
    return { blocked: names.length > 0, names };
  }, [displayRows, draft, request?.request_type, supplyAmendmentBundles]);

  const pharmaHistoryBlocks = useMemo(() => {
    if (!pharmaHistoryRowId || !request) return [];
    const row = items.find((i) => i.id === pharmaHistoryRowId);
    if (!row) return [];
    return buildPatientLineTimelineFr({
      row: row as PatientLineLike,
      requestCreatedAt: request.created_at,
      requestSubmittedAt: request.submitted_at,
      requestRespondedAt: request.responded_at,
      requestConfirmedAt: request.confirmed_at ?? null,
      requestStatus: request.status,
      supplyBundles: supplyAmendmentBundles,
      dossierHistory: dossierHistoryTimeline,
      dossierHistoryDetailParagraphs: pharmacistDossierHistoryDetailParagraphsFr,
      pharmacistProposedOriginLabel: getRequestKindWorkflowCopy(request.request_type).timelinePharmacistProposedOrigin,
      patientLineOriginLabel: getRequestKindWorkflowCopy(request.request_type).patientLineOriginLabel,
      requestType: request.request_type,
      timelineAudience: "pharmacist",
    });
  }, [pharmaHistoryRowId, request, items, supplyAmendmentBundles, dossierHistoryTimeline]);

  const supplyAmendmentBadgeLabelsByItemId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const row of items) {
      const labels = postConfirmSupplyAmendmentBadgeLabelsFr(row as PatientLineLike, supplyAmendmentBundles);
      if (labels.length > 0) map[row.id] = labels;
    }
    return map;
  }, [items, supplyAmendmentBundles]);

  let hardStopMotif: string | null = null;
  if (request && pharmacistRequestIsHardStopped(request.status)) {
    for (let i = dossierHistoryTimeline.length - 1; i >= 0; i--) {
      const h = dossierHistoryTimeline[i];
      if (h.new_status === request.status && h.reason?.trim()) {
        hardStopMotif = h.reason.trim();
        break;
      }
    }
  }

  const hardStopSummaryFr = pharmacistHardStopMotifSummaryFr(hardStopMotif);

  const closedSuccessPickupCount =
    request && pharmacistRequestIsClosedSuccess(request.status)
      ? items.filter(
          (i) =>
            i.is_selected_by_patient && !i.withdrawn_after_confirm && (i.counter_outcome ?? "unset") === "picked_up"
        ).length
      : null;

  const showClosedBucketsLayout = Boolean(
    request && usesLineWorkflow && pharmacistRequestIsClosedSuccess(request.status)
  );

  const closedRecuperesSubtotalLabel = (() => {
    if (!showClosedBucketsLayout) return null;
    const recuperes = displayRows.filter(
      (r) => r.is_selected_by_patient && (r.counter_outcome ?? "unset") === "picked_up"
    );
    let sumKnown = 0;
    let missingPrice = false;
    for (const row of recuperes) {
      const pl = row as PatientLineLike;
      const unit = validatedBranchUnitPriceMad(pl, pricingConfig);
      const qty = validatedQtyForPatientLine(pl);
      if (unit == null) missingPrice = true;
      else sumKnown += unit * qty;
    }
    return compactTotalMadLabel({
      sumKnown,
      missingPrice,
      empty: recuperes.length < 1,
    });
  })();

  const pharmacistArchiveFrozenClosureLabelFr = (row: PatientLineLike): string | null => {
    if ((row.counter_outcome ?? "unset") === "picked_up") return "Récupéré";
    if (row.withdrawn_after_confirm) return "Retiré";
    return null;
  };

  const renderArchiveValidatedLine = (row: ItemRow) => {
    const f = draft[row.id];
    if (!f || !request) return null;
    const pl = row as PatientLineLike;
    const patientLineCc = row.client_comment?.trim() ?? "";
    const lineConvoVisual = lineConversationVisual(patientLineCc, f.pharmacist_comment ?? "");
    const lineMessageButton = (
      <PharmacistLineMessageButton
        visual={lineConvoVisual}
        open={lineConvoRowId === row.id}
        onClick={() => setLineConvoRowId(row.id)}
      />
    );
    const onOpenHistory = () => {
      setSupplyMenuRowId(null);
      setPharmaHistoryRowId(row.id);
    };
    const prescriptionBadge =
      request.request_type === "prescription"
        ? patientPrescriptionLineBadge(request.request_type, pl, supplyAmendmentBundles)
        : null;
    const { validatedQty, unitPriceMad, lineTotalMad } = closedArchiveLinePricing(pl);
    return (
      <PharmacistClosedArchiveValidatedLine
        row={pl}
        archiveBucket={patientClosedArchiveLineBucket(pl)}
        archiveClosureLabel={pharmacistArchiveFrozenClosureLabelFr(pl)}
        requestType={request.request_type}
        supplyAmendmentBundles={supplyAmendmentBundles}
        pharmacistProposedBadgeLabel={
          getRequestKindConfig(request.request_type).copy.workflow.pharmacistProposedBadge
        }
        prescriptionBadge={prescriptionBadge}
        validatedName={closedArchiveProductLabel(pl)}
        validatedQty={validatedQty}
        unitPriceMad={unitPriceMad}
        lineTotalMad={lineTotalMad}
        thumbUrl={closedArchiveThumbUrl(pl)}
        lineMessageButton={lineMessageButton}
        menuOpen={supplyMenuRowId === row.id}
        onMenuOpenChange={(open) => setSupplyMenuRowId(open ? row.id : null)}
        onMenuHistory={onOpenHistory}
        postConfirmAmendmentBadges={supplyAmendmentBadgeLabelsByItemId[row.id]}
        onPhotoPreview={openProductPhotoPreview}
      />
    );
  };

  const renderClosedArchiveLine = (row: ItemRow, bucketId: PatientClosedArchiveLineBucketId) => {
    const f = draft[row.id];
    if (!f || !request) return null;
    const pl = row as PatientLineLike;
    const prod = one(row.products);
    const patientLineCc = row.client_comment?.trim() ?? "";
    const lineConvoVisual = lineConversationVisual(patientLineCc, f.pharmacist_comment ?? "");
    const lineMessageButton = (
      <PharmacistLineMessageButton
        visual={lineConvoVisual}
        open={lineConvoRowId === row.id}
        onClick={() => setLineConvoRowId(row.id)}
      />
    );
    const onOpenHistory = () => {
      setSupplyMenuRowId(null);
      setPharmaHistoryRowId(row.id);
    };

    if (bucketId === "non_retenus") {
      const eff = row.availability_status;
      const statusLabel = eff ? availabilityStatusFr[eff] ?? eff : null;
      const lineKindLabel =
        row.line_source === "pharmacist_proposed"
          ? request.request_type === "prescription"
            ? PRESCRIPTION_ADDITIONAL_PROPOSED_REASON
            : request.request_type === "free_consultation"
              ? getRequestKindConfig(request.request_type).copy.workflow.pharmacistProposedBadge || null
              : requestItemLineSourceFr.pharmacist_proposed
          : null;
      const thumbUrl = prod?.photo_url ? resolvePublicMediaUrl(prod.photo_url) : null;
      return (
        <PharmacistClosedArchiveNotRetainedLine
          row={row}
          productName={prod?.name ?? closedArchiveProductLabel(pl)}
          thumbUrl={thumbUrl}
          descriptionHtml={productDescriptionHtmlForDisplay(closedArchiveDescriptionHtml(pl))}
          statusLabel={statusLabel}
          lineKindLabel={lineKindLabel}
          qtyLabel={
            request.request_type === "prescription" ? "Qté prescrite" : "Qté demandée"
          }
          lineMessageButton={lineMessageButton}
          onOpenHistory={onOpenHistory}
          onPhotoPreview={openProductPhotoPreview}
        />
      );
    }

    const prescriptionBadge =
      request.request_type === "prescription"
        ? patientPrescriptionLineBadge(request.request_type, pl, supplyAmendmentBundles)
        : null;
    const { validatedQty, unitPriceMad, lineTotalMad } = closedArchiveLinePricing(pl);
    return (
      <PharmacistClosedArchiveValidatedLine
        row={pl}
        archiveBucket={bucketId}
        requestType={request.request_type}
        supplyAmendmentBundles={supplyAmendmentBundles}
        pharmacistProposedBadgeLabel={
          getRequestKindConfig(request.request_type).copy.workflow.pharmacistProposedBadge
        }
        prescriptionBadge={prescriptionBadge}
        validatedName={closedArchiveProductLabel(pl)}
        validatedQty={validatedQty}
        unitPriceMad={unitPriceMad}
        lineTotalMad={lineTotalMad}
        thumbUrl={closedArchiveThumbUrl(pl)}
        descriptionHtml={productDescriptionHtmlForDisplay(closedArchiveDescriptionHtml(pl))}
        lineMessageButton={lineMessageButton}
        menuOpen={supplyMenuRowId === row.id}
        onMenuOpenChange={(open) => setSupplyMenuRowId(open ? row.id : null)}
        onMenuHistory={onOpenHistory}
        postConfirmAmendmentBadges={supplyAmendmentBadgeLabelsByItemId[row.id]}
        onPhotoPreview={openProductPhotoPreview}
      />
    );
  };

  const resetDraftFromRows = useCallback(() => {
    const st = request?.status ?? null;
    const rt = request?.request_type ?? undefined;
    setDraft(() => {
      const next: Draft = {};
      for (const row of items) {
        next[row.id] = buildItemDraftFromRow(row, st, rt);
      }
      return next;
    });
  }, [items, request?.status, request?.request_type]);

  const cancelConfirmedSupplyEdits = useCallback(() => {
    resetDraftFromRows();
    setPendingProposalRows([]);
    setPendingAlternatives([]);
    setPendingDeletedAlternativeIds([]);
    setAltQtyDrafts({});
    setSupplyEditOpenRowIds({});
    setRemovedPersistedProposedIds([]);
    setSupplySaveGlobalChannel("");
    setSupplySaveGlobalMotive("");
    setError("");
  }, [resetDraftFromRows]);

  const handleConversationMarkedRead = useCallback(() => {
    setConversationUnread(false);
  }, []);

  const counterClosureEligible =
    request &&
    usesLineWorkflow &&
    ["confirmed", "treated"].includes(request.status) &&
    !archiveFrozen;
  const counterTrackedLines = counterClosureEligible ? pharmacistCounterTrackedLines(items) : [];
  const counterUnresolvedLines = counterClosureEligible
    ? pharmacistCounterUnresolvedLines(counterTrackedLines)
    : [];
  const canCompleteCounter = counterClosureEligible
    ? pharmacistCanCompleteCounterClosure(items)
    : false;
  const counterClosurePendingTracked = counterUnresolvedLines.length;

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error && !request) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        <Link href="/dashboard/pharmacien/demandes" className="mt-3 inline-block text-xs font-medium text-emerald-900 underline">
          Demandes de produits
        </Link>
      </PageShell>
    );
  }

  if (!request) return null;

  const kindConfig = getRequestKindConfig(request.request_type);
  const workflowCopy = kindConfig.copy.workflow;
  const ordonnanceLineBadge = workflowCopy.pharmacistOrdonnanceLineBadge ?? "Ordonnance";
  const proposedBadgeLabel = workflowCopy.pharmacistProposedBadge;

  const showConsultationTabbed =
    isConsultation &&
    consultationBrief != null &&
    !pharmacistRequestIsHardStopped(request.status) &&
    ["submitted", "in_review", "responded"].includes(request.status);
  const consultationDossierRef =
    displayRequestPublicRef(request) || `Dossier ${request.id.slice(0, 8)}…`;
  const consultationSeed =
    consultationBrief != null
      ? {
          text: consultationBrief.text,
          paths: consultationBrief.paths,
          createdAt: request.submitted_at ?? request.created_at,
          modifiedAt: consultationBrief.contentUpdatedAt,
        }
      : null;
  const showConsultationProductsPane = !showConsultationTabbed || consultationTab === "products";

  const consultationTabSyncKey = showConsultationTabbed
    ? `${request.id}|${request.status}|${request.responded_at ?? ""}`
    : "";
  if (consultationTabSyncKey && consultationTabSyncKey !== prevConsultationTabSyncKey) {
    setPrevConsultationTabSyncKey(consultationTabSyncKey);
    const nextTab = getConsultationDefaultTab(request.status, request.responded_at);
    setConsultationTab(nextTab);
    if (nextTab === "products") setConversationOpen(false);
  }

  const patientPhone = patientProfile?.whatsapp?.trim();
  const patientEmail = patientProfile?.email?.trim();
  let selectedLinesActiveCount = 0;
  let pendingCounterCount = 0;
  let pickedUpCount = 0;
  for (const row of displayRows) {
    if (!row.is_selected_by_patient) continue;
    const fd = draft[row.id];
    const withdrawn = Boolean(row.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
    if (withdrawn) continue;
    selectedLinesActiveCount += 1;
  }
  for (const i of items) {
    if (!i.is_selected_by_patient) continue;
    const fd = draft[i.id];
    const withdrawn = Boolean(i.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
    if (withdrawn) continue;
    const co = i.counter_outcome ?? "unset";
    if (co === "unset") pendingCounterCount += 1;
    else if (co === "picked_up") pickedUpCount += 1;
  }

  const showSupplyDirtyBar = Boolean(
    canManageSupply && supplyStructuralDirty && !ordonnanceQuickAddOpen && !requestDrift.stale
  );

  const showDeclareTreatedSticky =
    usesLineWorkflow &&
    request.status === "confirmed" &&
    !respondedFrozenView &&
    canManageSupply &&
    !showSupplyDirtyBar &&
    pharmacistActiveRetainedLineCount(items, draft) > 0;

  const showCloseCounterSticky =
    Boolean(counterClosureEligible && canCompleteCounter) &&
    !supplyStructuralDirty &&
    !showSupplyDirtyBar;

  const showSupplyStatsFooter = usesLineWorkflow && Boolean(canManageSupply) && displayRows.length > 0;

  const showBottomActionSticky = showDeclareTreatedSticky || showCloseCounterSticky;

  const isProductRequest = request.request_type === "product_request";
  /** Demande produits : même cartes/onglets que « envoyée », y compris `responded` (consultation ou édition). */
  const isProductRequestSent =
    isProductRequest && ["submitted", "in_review", "responded"].includes(request.status);
  const isPrescriptionWorkflowSent =
    isPrescription && ["submitted", "in_review", "responded"].includes(request.status);
  const isConsultationWorkflowSent =
    isConsultation && ["submitted", "in_review", "responded"].includes(request.status);
  const usePharmaSentLineLayout =
    isProductRequestSent || isPrescriptionWorkflowSent || isConsultationWorkflowSent;
  const isProductRequestValidated =
    isProductRequest && ["confirmed", "treated"].includes(request.status);
  const isConsultationValidated =
    isConsultation && ["confirmed", "treated"].includes(request.status);
  const useCompactProductLineSupplyEditor = isProductRequestValidated || isConsultationValidated;
  const consultationProposeFormAlwaysOpen = isConsultation && !canManageSupply;
  const hideMainRequestHeader =
    usesLineWorkflow &&
    (["submitted", "in_review", "responded", "confirmed", "treated"].includes(request.status) ||
      pharmacistRequestIsHardStopped(request.status) ||
      pharmacistRequestIsClosedSuccess(request.status));

  const isPharmacistTerminalArchive =
    pharmacistRequestIsHardStopped(request.status) || pharmacistRequestIsClosedSuccess(request.status);

  const pharmacistArchiveTerminalFootnote = isPharmacistTerminalArchive
    ? (() => {
        const entry = findTerminalStatusHistoryEntry(
          dossierHistoryTimeline.map((h, i) => ({ ...h, id: String(i) })),
          request.status
        );
        return entry?.created_at ? archiveTerminalFootnoteFr(entry.created_at) : null;
      })()
    : null;

  let dossierStatusHint = "";
  if (usesLineWorkflow && hideMainRequestHeader) {
    if (request.status === "submitted" || request.status === "in_review") {
      if (isPrescription) {
        dossierStatusHint = "";
      } else if (isConsultation) {
        dossierStatusHint =
          "Échangez avec le patient ou ajoutez des produits, puis publiez la réponse.";
      } else {
        dossierStatusHint =
          "Répondez au patient puis publiez la proposition (alternatives possibles par onglet).";
      }
    } else if (request.status === "responded") {
      dossierStatusHint = "En attente de validation patient — délai 24 h après votre réponse.";
    } else if (request.status === "confirmed") {
      dossierStatusHint =
        "Commande validée — préparez les lignes, déclarez traitée quand c’est prêt, puis suivez le comptoir.";
    } else if (request.status === "treated") {
      const pickedN = pharmacistCounterPickedUpCount(items);
      dossierStatusHint = canCompleteCounter
        ? pickedN > 0 && counterClosurePendingTracked > 0
          ? `${pickedN} produit${pickedN > 1 ? "s" : ""} récupéré${pickedN > 1 ? "s" : ""} — vous pouvez clôturer (les non récupérés seront retirés).`
          : "Au moins un produit récupéré — vous pouvez clôturer le dossier."
        : counterClosurePendingTracked > 0
          ? "Comptoir : marquez au moins un produit « Récupéré » pour pouvoir clôturer."
          : "Marquez « Récupéré » sur au moins une ligne retenue pour clôturer le dossier.";
    }
  }

  const showMainSupplyFooter =
    !respondedEditMode && (showBottomActionSticky || showSupplyStatsFooter || showSupplyDirtyBar);

  let bottomChromePaddingClass = "";
  if (respondedEditMode) {
    bottomChromePaddingClass = stickyFooterPadClass("pharmaEdit");
  } else if (showBottomActionSticky && showSupplyStatsFooter) {
    bottomChromePaddingClass = stickyFooterPadClass(showSupplyDirtyBar ? "pharmaTriple" : "pharmaDouble");
  } else if (showBottomActionSticky) {
    bottomChromePaddingClass = stickyFooterPadClass(showSupplyDirtyBar ? "pharmaDouble" : "pharmaSingle");
  } else if (showSupplyStatsFooter) {
    bottomChromePaddingClass = stickyFooterPadClass(showSupplyDirtyBar ? "pharmaDouble" : "compact");
  } else if (showSupplyDirtyBar) {
    bottomChromePaddingClass = stickyFooterPadClass("pharmaSingle");
  }

  const stickyFooterObscured =
    publishConfirmOpen ||
    respondedSaveConfirmOpen ||
    supplySaveConfirmOpen ||
    declareTreatedModalOpen ||
    closeConfirmOpen ||
    cancelModalOpen ||
    ordonnanceQuickAddOpen ||
    Boolean(prescriptionScanLightbox) ||
    prescriptionScanPanelOpen ||
    pharmaHistoryRowId != null ||
    conversationOpen;

  return (
    <PageShell
      maxWidthClass="max-w-3xl"
      className={clsx(
        usesLineWorkflow && hideMainRequestHeader
          ? pharmacistProductDossierPageClass
          : "space-y-2 sm:space-y-3",
        usesLineWorkflow && !hideMainRequestHeader && "bg-slate-50",
        bottomChromePaddingClass
      )}
    >
      <RequestDetailBackLink config={kindConfig} viewerRole="pharmacien" />

      {showConsultationTabbed ? (
        <ConsultationRequestDetailChrome
          header={
            <PharmacistProductRequestDossierHeader
              dossierRefLabel={consultationDossierRef}
              kindLabel={kindConfig.copy.labelFr}
              requestType={request.request_type}
              patientName={patientProfile?.full_name ?? null}
              patientRef={patientProfile?.patient_ref ?? null}
              patientPhone={patientPhone ?? null}
              status={request.status}
              statusHint={dossierStatusHint}
              submittedAt={request.submitted_at}
              createdAt={request.created_at}
            />
          }
          tab={consultationTab}
          onTab={setConsultationTab}
          conversationUnread={conversationUnread}
          productLineCount={displayRows.length}
        />
      ) : hideMainRequestHeader ? (
        <>
          <PharmacistProductRequestDossierHeader
            dossierRefLabel={displayRequestPublicRef(request) || formatShortId(request.id)}
            kindLabel={kindConfig.copy.labelFr}
            requestType={request.request_type}
            patientName={patientProfile?.full_name ?? null}
            patientRef={patientProfile?.patient_ref ?? null}
            patientPhone={patientPhone ?? null}
            status={request.status}
            statusHint={dossierStatusHint}
            submittedAt={request.submitted_at}
            createdAt={request.created_at}
            hideSentAt={isPharmacistTerminalArchive}
          />
          {!showConsultationTabbed &&
          isConsultation &&
          ["submitted", "in_review"].includes(request.status) ? (
            <section className={pharmacistProductSecondaryBannerClass}>
              <p className="font-semibold">Consultation en cours</p>
              <p className="mt-0.5 text-muted-foreground">
                Échangez dans l&apos;onglet Conversation, puis ajoutez des produits avant publication.
              </p>
            </section>
          ) : null}
          {(isProductRequest || isPrescription || isConsultation) && sharedShowPlannedVisitBlock(request.status) ? (
            <section className={pharmacistProductPlannedVisitClass} aria-label="Date de passage patient">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Date de passage
              </p>
              <p className="mt-1 text-[15px] font-bold leading-snug tabular-nums text-foreground sm:text-base">
                {request.patient_planned_visit_date
                  ? formatPlannedVisitFr(
                      request.patient_planned_visit_date,
                      request.patient_planned_visit_time
                    )
                  : "À définir par le patient"}
              </p>
            </section>
          ) : null}
        </>
      ) : (
        <RequestKindHeader
          config={kindConfig}
          request={request}
          lineCount={usesLineWorkflow ? displayRows.length : null}
          showPlannedVisit={sharedShowPlannedVisitBlock(request.status)}
          viewerRole="pharmacien"
        />
      )}

      {pharmacistRequestIsHardStopped(request.status) && usesLineWorkflow ? (
        <section
          className={clsx(
            "rounded-lg border px-3 py-2 shadow-sm",
            hideMainRequestHeader
              ? "border-border/80 bg-card text-foreground"
              : clsx(
                  request.status === "cancelled" && "border-rose-200/90 bg-rose-50/55 text-rose-950",
                  request.status === "abandoned" && "border-orange-200/90 bg-orange-50/55 text-orange-950",
                  request.status === "expired" && "border-amber-200/90 bg-amber-50/55 text-amber-950",
                  isPrescription && "ring-1 ring-amber-200/50",
                  isConsultation && "ring-1 ring-violet-200/50"
                )
          )}
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
            {pharmacistHardStopSectionCopy(
              request.status as "cancelled" | "abandoned" | "expired",
              isConsultation ? "free_consultation" : isPrescription ? "prescription" : "product_request"
            ).kickerSuffix}
          </p>
          <p className="mt-0.5 text-[13px] font-semibold leading-snug">
            {requestStatusFr[request.status] ?? request.status}
          </p>
          {hardStopSummaryFr ? (
            <p className="mt-1.5 text-[11px] leading-snug text-foreground/90">{hardStopSummaryFr}</p>
          ) : (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Aucun motif complémentaire enregistré.</p>
          )}
        </section>
      ) : null}

      {pharmacistRequestIsClosedSuccess(request.status) && usesLineWorkflow ? (
        <section
          className={clsx(
            "rounded-lg border px-3 py-2 text-[11px] shadow-sm",
            hideMainRequestHeader
              ? "border-border/80 bg-card text-foreground"
              : isPrescription
                ? "border-amber-200/85 bg-amber-50/65 text-amber-950"
                : isConsultation
                  ? "border-violet-200/85 bg-violet-50/65 text-violet-950"
                  : "border-emerald-200/85 bg-emerald-50/65 text-emerald-950"
          )}
        >
          <p
            className={clsx(
              "text-[9px] font-bold uppercase tracking-wide",
              isPrescription ? "text-amber-900/75" : isConsultation ? "text-violet-900/75" : "text-emerald-900/75"
            )}
          >
            Clôture
          </p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug">
            {pharmacistClosedSuccessIntro(
              isConsultation ? "free_consultation" : isPrescription ? "prescription" : "product_request"
            )}
          </p>
          <p className="mt-1 font-semibold tabular-nums">
            {closedSuccessPickupCount ?? 0} ligne{(closedSuccessPickupCount ?? 0) !== 1 ? "s" : ""} retirée
            {(closedSuccessPickupCount ?? 0) !== 1 ? "s" : ""} au comptoir (retenues).
          </p>
        </section>
      ) : null}

      {!hideMainRequestHeader ? (
        <section className="rounded-xl border border-emerald-300/60 bg-gradient-to-br from-emerald-50/85 via-white to-teal-50/40 px-2 py-1.5 shadow-sm ring-1 ring-emerald-200/45 sm:px-2.5">
          <div className="flex gap-2 sm:items-center sm:gap-2.5">
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm sm:size-8"
              title="Client"
              aria-hidden
            >
              <User className="size-3.5 sm:size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2 gap-y-1">
                <p className="min-w-[40%] flex-1 break-words text-[11px] font-bold leading-snug text-emerald-950 sm:text-[12px]">
                  {patientHeadingName(patientProfile, request.patient_id)}
                </p>
                {patientPhone || patientEmail ? (
                  <button
                    type="button"
                    aria-expanded={patientContactOpen}
                    onClick={() => setPatientContactOpen((v) => !v)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-400/70 bg-white px-1.5 py-0.5 text-[9px] font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-50 sm:px-2 sm:py-1 sm:text-[10px]"
                  >
                    <Phone className="size-3 shrink-0 opacity-90" aria-hidden />
                    Contacter
                    <ChevronDown
                      className={clsx("size-3 shrink-0 text-emerald-800/80 transition-transform", patientContactOpen && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                ) : null}
              </div>
              <p className="mt-0.5 break-all font-mono text-[9px] font-semibold tabular-nums text-emerald-950/90 sm:text-[10px]">
                {patientProfile?.patient_ref?.trim() || `#${formatShortId(request.patient_id)}`}
              </p>
              {(patientPhone || patientEmail) && patientContactOpen ? (
                <div className="mt-1.5 flex flex-wrap gap-1 border-t border-emerald-200/80 pt-1.5">
                  {patientPhone ? (
                    <>
                      <a
                        href={telHref(patientPhone)}
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                        title={`Appeler ${patientPhone}`}
                      >
                        <Phone className="size-4" aria-hidden />
                      </a>
                      <a
                        href={smsHref(patientPhone)}
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                        title="SMS"
                      >
                        <MessageSquare className="size-4" aria-hidden />
                      </a>
                      <a
                        href={whatsappHref(patientPhone)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-400/70 bg-white text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                        title="WhatsApp"
                      >
                        <MessageCircle className="size-4" aria-hidden />
                      </a>
                    </>
                  ) : null}
                  {patientEmail ? (
                    <a
                      href={`mailto:${patientEmail}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-sky-400/70 bg-white text-sky-900 shadow-sm transition hover:bg-sky-50"
                      title={patientEmail}
                    >
                      <Mail className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {showConsultationProductsPane &&
      usesLineWorkflow &&
      request &&
      isConsultation &&
      ["submitted", "in_review"].includes(request.status) &&
      !pharmacistRequestIsHardStopped(request.status) ? (
        <section className={clsx(PHARMA_STATUS_BANNER, "border-violet-200/70 bg-violet-50/45 text-violet-950")}>
          <p className="font-semibold text-violet-950">Consultation</p>
          <p className="text-violet-900/88">Conversation ou produits — puis publier.</p>
        </section>
      ) : null}

      {!hideMainRequestHeader &&
      usesLineWorkflow &&
      request?.status === "confirmed" &&
      !pharmacistRequestIsHardStopped(request.status) ? (
        <section className={clsx(PHARMA_STATUS_BANNER, "border-teal-200/70 bg-teal-50/45 text-teal-950")}>
          <p className="font-semibold text-teal-950">Validée patient</p>
          <p className="text-teal-900/88">Pastilles = enregistrement direct · retraits = barre du bas.</p>
        </section>
      ) : null}

      {!hideMainRequestHeader &&
      usesLineWorkflow &&
      request?.status === "treated" &&
      !pharmacistRequestIsHardStopped(request.status) ? (
        <section className={clsx(PHARMA_STATUS_BANNER, "border-violet-200/70 bg-violet-50/40 text-violet-950")}>
          <p className="font-semibold text-violet-950">Comptoir</p>
          <p className="text-violet-900/88">Marquer récupéré par ligne · autres modifs via la barre du bas.</p>
        </section>
      ) : null}

      {respondedEditMode && request?.status === "responded" && usesLineWorkflow ? (
        <section
          id="pharma-demande-mode-edition"
          className={clsx(
            "sticky top-0 z-20 text-center text-[10px] shadow-sm",
            hideMainRequestHeader
              ? clsx(PHARMA_STATUS_BANNER, "text-foreground")
              : "rounded-lg border border-amber-300/80 bg-amber-50/90 px-2.5 py-1.5 ring-1 ring-amber-200/50"
          )}
        >
          <p className={clsx("font-bold", hideMainRequestHeader ? "text-foreground" : "text-amber-950")}>
            Modification en cours
          </p>
          {!hideMainRequestHeader ? (
            <p className="text-amber-900/85">Visible patient après enregistrement.</p>
          ) : null}
        </section>
      ) : null}

      {respondedFrozenView && usesLineWorkflow && !hideMainRequestHeader ? (
        <section className={clsx(PHARMA_STATUS_BANNER, "text-foreground")}>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="shrink-0 rounded-full border border-amber-300/80 bg-white px-1.5 py-px text-[8px] font-bold uppercase text-amber-950">
              Publiée
            </span>
            <p className="min-w-0 flex-1 tabular-nums">
              {request.responded_at ? formatDateTimeShort24hFr(request.responded_at) : "—"} · attente patient
            </p>
            <InfoHint label="Réponse publiée" align="end">
              <p>Vision patient actuelle. Modifier via « Modifier la réponse », puis enregistrer en bas.</p>
            </InfoHint>
          </div>
        </section>
      ) : null}

      {requestDrift.stale ? (
        <div className="rounded-lg border border-amber-300/80 bg-amber-50/90 p-3 text-[11px] text-amber-950 shadow-sm">
          <p className="font-bold">{requestDrift.stale.title}</p>
          <p className="mt-1 leading-snug">{requestDrift.stale.message}</p>
          <button
            type="button"
            className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-500/80 bg-white px-3 font-semibold text-amber-950 hover:bg-amber-50"
            onClick={() => void requestDrift.refresh()}
          >
            Actualiser la page
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {kindConfig.capabilities.workflowEnabled ? (
        <>
          {showConsultationTabbed && consultationTab === "conversation" && sessionUserId ? (
            <div
              className={clsx(
                "flex min-h-0 min-w-0 flex-1 flex-col",
                consultationConversationViewportHeightClass("none")
              )}
            >
              <RequestConversationInline
                requestId={request.id}
                viewerRole="pharmacien"
                currentUserId={sessionUserId}
                variant="consultation"
                consultationSeed={consultationSeed}
                refreshToken={conversationRefreshToken}
                fillViewport
                onMarkedRead={handleConversationMarkedRead}
              />
            </div>
          ) : null}

          {showConsultationProductsPane && isPrescription && request.status === "draft" ? (
            <p className="mt-2 rounded-lg border border-amber-300/80 bg-amber-50/60 p-2.5 text-[11px] leading-snug text-amber-950">
              Envoi patient incomplet (brouillon). Aucune action officine : le patient doit renvoyer l’ordonnance depuis la fiche
              pharmacie. Vous pouvez ignorer cette ligne ou l’annuler si elle traîne.
            </p>
          ) : null}

          {showConsultationProductsPane && displayRows.length === 0 && !isPrescription && !isConsultation ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Aucune ligne produit.</p>
          ) : showConsultationProductsPane ? (
            <>
              {isPrescription && prescriptionPaths?.page1 && ordonnanceCatalogEditable ? (
                <PrescriptionScanCollapsible
                  id="prescription-scan-panel"
                  className="mt-2"
                  paths={prescriptionPaths}
                  defaultOpen={ordonnanceLineCount === 0}
                  controlledLightbox={prescriptionScanLightbox}
                  onControlledLightboxChange={setPrescriptionScanLightbox}
                  controlledActiveTab={prescriptionScanActiveTab}
                  onControlledActiveTabChange={setPrescriptionScanActiveTab}
                  onPanelOpenChange={setPrescriptionScanPanelOpen}
                  ordonnanceQuickAdd={{
                    lineCount: ordonnanceLineCount,
                    onOpenAdd: () => {
                      setError("");
                      resetOrdonnanceQuickAddForm();
                      setOrdonnanceQuickAddOpen(true);
                    },
                  }}
                />
              ) : null}
              {displayRows.length === 0 && isConsultation && showLineAndPublishEdits ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{workflowCopy.pharmacistEmptyLinesHint}</p>
              ) : null}
              {displayRows.length === 0 && isPrescription && showLineAndPublishEdits ? (
                <p className="mt-2 text-[11px] leading-snug text-amber-950/90">{workflowCopy.pharmacistEmptyLinesHint}</p>
              ) : null}
              {displayRows.length > 0 ? (
              <>
              {(hideMainRequestHeader && !ordonnanceCatalogEditable) ? null : (
              <div className="flex flex-wrap items-end justify-between gap-1.5 sm:gap-2">
              {hideMainRequestHeader ? null : (
                <div>
                  <h2 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground sm:text-xs">
                    {workflowCopy.pharmacistLinesSectionTitle}
                  </h2>
                  {["confirmed", "treated", "completed"].includes(request.status) ? (
                    <div className="mt-1 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                      <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">Sél. {selectedLinesActiveCount}</span>
                      {request.status === "treated" || request.status === "completed" ? (
                        <>
                          <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">
                            Attente comptoir {pendingCounterCount}
                          </span>
                          <span className="rounded-md bg-muted/80 px-1.5 py-px font-medium text-foreground">
                            Récp. {pickedUpCount}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            <div className="flex flex-wrap items-center justify-end gap-2">
              {hideMainRequestHeader ? null : (
                <span className="text-[10px] text-muted-foreground">{displayRows.length} article(s)</span>
              )}
            </div>
          </div>
              )}
          {hideMainRequestHeader &&
          (isProductRequest || isConsultation) &&
          displayRows.length > 0 &&
          !showClosedBucketsLayout &&
          !showArchiveFrozenProducts ? (
            <h3 className={pharmacistProductSectionTitleClass}>
              {workflowCopy.patientProductsSectionTitle}
            </h3>
          ) : null}
          <div
            className={clsx(
              "flex flex-col",
              hideMainRequestHeader &&
                (isProductRequest ||
                  isPrescriptionWorkflowSent ||
                  isProductRequestSent ||
                  isProductRequestValidated ||
                  isConsultationWorkflowSent ||
                  isConsultationValidated ||
                  showClosedBucketsLayout ||
                  showArchiveFrozenProducts)
                ? pharmacistProductLinesWrapperClass
                : hideMainRequestHeader
                  ? isProductRequestSent ||
                    isProductRequestValidated ||
                    isConsultationWorkflowSent ||
                    isConsultationValidated
                    ? "mt-3 gap-2"
                    : ""
                  : "mt-2 gap-3"
            )}
          >
            {isPrescription &&
            prescriptionPaths?.page1 &&
            !ordonnanceCatalogEditable &&
            (showClosedBucketsLayout || showArchiveFrozenProducts) ? (
              <PrescriptionScanCollapsible
                id="prescription-scan-panel-archive"
                className="mb-2"
                paths={prescriptionPaths}
                defaultOpen={false}
              />
            ) : null}
            {showClosedBucketsLayout ? (
              <PharmacistClosedProductBucketsView
                items={displayRows}
                recuperesSubtotalLabel={closedRecuperesSubtotalLabel}
                recuperesTotalLabel={closedRecuperesSubtotalLabel}
                renderLine={(row, bucketId) => renderClosedArchiveLine(row, bucketId)}
              />
            ) : null}
            {showArchiveFrozenProducts && request && uiRequestStatus ? (
              <PharmacistArchiveFrozenProductsView
                snapshotStatus={uiRequestStatus as import("@/lib/request-archive-snapshot-status").RequestArchiveSnapshotStatus}
                terminalStatus={request.status}
                items={displayRows}
                productsSectionTitle={workflowCopy.patientProductsSectionTitle}
                requestType={request.request_type}
                supplyAmendmentBundles={supplyAmendmentBundles}
                archiveSel={archiveSel}
                pricingConfig={pricingConfig}
                pharmacistProposedBadgeLabel={proposedBadgeLabel}
                badgeForRow={(row) => {
                  if (request.request_type === "prescription") {
                    return (
                      patientPrescriptionLineBadge(request.request_type, row as PatientLineLike, supplyAmendmentBundles) ??
                      undefined
                    );
                  }
                  return undefined;
                }}
                onPhotoPreview={openProductPhotoPreview}
                resolveCatalogUnitPriceForProduct={(productId, embed) => {
                  const label = formatPharmacyCatalogPrice(
                    pricingConfig,
                    productEmbedToPricingInput(
                      embed
                        ? {
                            product_type: embed.product_type ?? "parapharmacie",
                            price_pph: embed.price_pph,
                            price_ppv: embed.price_ppv,
                            brand: embed.brand,
                          }
                        : null,
                      productId
                    )
                  );
                  if (label === "—") return null;
                  const n = Number.parseFloat(label.replace(/[^\d.,]/g, "").replace(",", "."));
                  return Number.isFinite(n) ? n : null;
                }}
                renderValidatedLine={renderArchiveValidatedLine}
                renderNotRetainedLine={(row) => renderClosedArchiveLine(row, "non_retenus")}
              />
            ) : null}
            {!showClosedBucketsLayout && !showArchiveFrozenProducts ? (
              <>
                {pharmacistSupplySurfaceGroups.map((group, gi) => {
                  const bucket = group.bucketMeta;
                  const listBody = (
                <ul
                  className={clsx(
                    "flex w-full min-w-0 flex-col overflow-visible",
                    bucket
                      ? patientBucketProductListClass
                      : hideMainRequestHeader && (isProductRequest || isConsultation)
                        ? "flex w-full min-w-0 flex-col gap-2"
                        : usePharmaSentLineLayout
                          ? "gap-2"
                          : "divide-y divide-border/50"
                  )}
                >
                  {group.entries.map(({ header, row }, entryIdx) => {
              const prod = one(row.products);
              const f = draft[row.id];
              if (!f) return null;
              const draftIndicativePuMad =
                f.unit_price.trim() !== ""
                  ? `${Number(f.unit_price.replace(",", ".")).toFixed(2)}\u00A0MAD`
                  : formatPharmacyCatalogPrice(
                      pricingConfig,
                      productEmbedToPricingInput(
                        prod
                          ? {
                              product_type: prod.product_type ?? "parapharmacie",
                              price_pph: prod.price_pph,
                              price_ppv: prod.price_ppv,
                              brand: prod.brand,
                            }
                          : null,
                        row.product_id
                      )
                    ).replace("\u00A0DH", "\u00A0MAD");
              const co = row.counter_outcome ?? "unset";
              const selected = Boolean(row.is_selected_by_patient);
              const lineLockedTrace = co === "cancelled_at_counter";
              const canEditThisRow = showLineAndPublishEdits && !lineLockedTrace && !archiveFrozen;
              const rowAlts = normalizeAlts(row.request_item_alternatives);
              const showVariantTabs =
                (usePharmaSentLineLayout &&
                  !lineLockedTrace &&
                  (respondedFrozenView || (showLineAndPublishEdits && canEditThisRow))) ||
                (showLineAndPublishEdits && canEditThisRow && !lineLockedTrace && !usePharmaSentLineLayout);
              const storedAltTab: PharmacistLineAltTabId = lineAltTabByRowId[row.id] ?? "principal";
              const activeAltTab: PharmacistLineAltTabId = showVariantTabs
                ? respondedFrozenView && storedAltTab === PHARMACIST_ALT_TAB_ADD
                  ? "principal"
                  : storedAltTab
                : "principal";
              const showAltPicker = showVariantTabs && activeAltTab === PHARMACIST_ALT_TAB_ADD;
              const showPrincipalVariant = !showAltPicker && activeAltTab === "principal";
              const activeAltRow =
                showVariantTabs && !showAltPicker && activeAltTab !== "principal"
                  ? rowAlts.find((a) => a.id === activeAltTab) ?? null
                  : null;
              const chosenAltId = row.patient_chosen_alternative_id ?? null;
              const chosenAltRow = chosenAltId ? rowAlts.find((a) => a.id === chosenAltId) : null;
              const lineEditorPhotoPath = validatedBranchPhotoPath(row as PatientLineLike);
              const withdrawnDraft = Boolean(f.withdrawn_after_confirm);
              const showPatientConfirmedChoice =
                selected &&
                (request.status === "confirmed" ||
                  request.status === "treated" ||
                  request.status === "completed");
              const showInlineCounter = request.status === "completed" || request.status === "treated";
              const outcomeSelectDisabled =
                request.status === "completed" ||
                counterBusyId === row.id ||
                !selected ||
                !showInlineCounter;
              const isProposedLine = isPharmacistProposedRow(row);
              const isPostConfirmAddedLine = isRequestItemAddedAfterPatientConfirmation(
                row.id,
                supplyAmendmentBundles
              );
              const isAjoutOfficineLine =
                (request != null && isProductRequestAjoutOfficineLine(request.request_type, row)) ||
                isPostConfirmAddedLine;
              const ajoutOfficineBadgeLabel = isPostConfirmAddedLine
                ? POST_CONFIRM_LINE_ADDED_BADGE_FR
                : proposedBadgeLabel;
              const isOrdonnancePrincipalLine =
                request != null &&
                isPrescriptionOrdonnancePrincipalLine(request.request_type, row, supplyAmendmentBundles);
              const isOrdonnancePharmacistLine = isOrdonnancePrincipalLine;
              const isPrescriptionExtraProposed =
                request != null &&
                isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
              const isProposedForAvailInference = isProposedLineForAvailabilityInference(
                request?.request_type ?? "product_request",
                row,
                supplyAmendmentBundles,
                { isAjoutOfficineLine, isPrescriptionExtraProposed }
              );
              const draftAvailQty = Number(f.available_qty);
              const draftRequestedQtyForInfer = isOrdonnancePharmacistLine
                ? ordonnanceDraftRequestedQty(row, f)
                : inferRequestedQtyForAvailability(row);
              const draftInferredStatus = inferAvailabilityStatusFromQty({
                status: f.availability_status,
                availableQty: Number.isFinite(draftAvailQty) ? draftAvailQty : 0,
                requestedQty: draftRequestedQtyForInfer,
                isProposedLine: isProposedForAvailInference,
              });
              const statusForBadge =
                lineLockedTrace || respondedFrozenView || !canEditThisRow
                  ? row.availability_status
                  : draftInferredStatus;
              const availUi = availabilityStatusUi(statusForBadge);
              const AvailIcon = availUi.Icon;
              const lineProposedBadge = isConsultation
                ? null
                : isOrdonnancePrincipalLine
                  ? ordonnanceLineBadge
                  : isPrescriptionExtraProposed || isAjoutOfficineLine || isProposedLine
                    ? proposedBadgeLabel
                    : null;
              const compactOriginBadgeLabel =
                isPostConfirmAddedLine || isAjoutOfficineLine ? null : lineProposedBadge;
              const compactOriginBadgeTone: "ordonnance" | "proposed" = isOrdonnancePrincipalLine
                ? "ordonnance"
                : "proposed";
              const stockCeiling = draftStockCeilingForRow(row);
              const stockParsedQty = Number(f.available_qty);
              const stockPlusDisabled =
                !canEditThisRow ||
                withdrawnDraft ||
                f.availability_status === "market_shortage" ||
                (Number.isFinite(stockParsedQty) && stockParsedQty >= stockCeiling);
              const stockStepperDisabled =
                !canEditThisRow ||
                withdrawnDraft ||
                f.availability_status === "market_shortage" ||
                f.availability_status === "unavailable";
              const minStockFloor = f.availability_status === "to_order" ? 1 : isAjoutOfficineLine ? 1 : 0;
              const stockMinusDisabled =
                stockStepperDisabled ||
                (Number.isFinite(stockParsedQty) && stockParsedQty <= minStockFloor);
              const patientLineCc = row.client_comment?.trim() ?? "";
              const lineConvoVisual = lineConversationVisual(patientLineCc, f.pharmacist_comment ?? "");
              const availabilityOptions = pharmacistAvailabilityOptionsForLine(
                request?.request_type ?? "product_request",
                { isAjoutOfficineLine, isPrescriptionExtraProposed }
              );

              if (canManageSupply) {
                const pl = row as PatientLineLike;
                const validatedName = validatedProductLabel(pl);
                const validatedBrand = validatedProductBrand(pl);
                const validatedQty = validatedQtyForPatientLine(pl);
                const effSupply = effectiveAvailSupplyDraft(row, f, request?.request_type, request?.status);
                const etaSupply = effectiveEtaSupplyDraft(row, f, request?.request_type, request?.status);
                const supplyTier: PharmacistSupplyLineTier | undefined = bucket
                  ? supplyTierForBucketKind(bucket.kind)
                  : undefined;
                let availSentence = "";
                if (!selected) availSentence = "Non retenu";
                else if (effSupply === "to_order") {
                  const etaFr = etaSupply ? formatDateShortFr(etaSupply) : null;
                  availSentence =
                    supplyTier === "commande"
                      ? etaFr
                        ? `Réception prévue · ${etaFr}`
                        : "—"
                      : `À commander${etaFr ? ` · dispo indicative ${etaFr}` : ""}`;
                } else if (effSupply) {
                  const raw = availabilityStatusFr[effSupply] ?? effSupply;
                  availSentence =
                    supplyTier === "dispo_officine" && raw === "Disponible" ? "—" : raw;
                } else availSentence = "—";

                const branchPrice = validatedBranchUnitPriceMad(pl);
                const lineTot = branchPrice != null ? branchPrice * validatedQty : null;
                const unitLabel = branchPrice != null ? `${branchPrice.toFixed(2)} MAD` : "—";
                const totalLabel = lineTot != null ? `${lineTot.toFixed(2)} MAD` : "—";
                const thumbUrl = resolvePublicMediaUrl(validatedBranchPhotoPath(pl));
                const ordonnancePrescribedQty =
                  request.request_type === "prescription" && isOrdonnancePrincipalLine
                    ? ordonnanceDraftRequestedQty(row, f)
                    : null;
                const isSupplyLineEditing = Boolean(supplyEditOpenRowIds[row.id]);
                const lineCounterLocked = (row.counter_outcome ?? "unset") === "picked_up";
                const canMarkReservedSupply = false;
                const canMarkOrderedSupply = false;
                const isPendingLocalAdd = isLocalProposedItemId(row.id);
                const canShowArrivedReservedPill =
                  !archiveFrozen &&
                  !isPendingLocalAdd &&
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  effSupply === "to_order" &&
                  (request.status === "confirmed" || request.status === "treated");
                const canMarkPickedUpCounterSupply =
                  !isPendingLocalAdd &&
                  request.status === "treated" &&
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace;
                const prescriptionBadgeForLabels =
                  bucket && request.request_type === "prescription"
                    ? patientPrescriptionLineBadge(request.request_type, pl, supplyAmendmentBundles)
                    : null;
                const validatedLineLabels = bucket
                  ? buildPatientValidatedLineLabelsFr({
                      row: rowForValidatedLineLabels(row, f, request.request_type),
                      originLabel: validatedOriginLabelPharmacistFr({
                        row: pl,
                        requestType: request.request_type,
                        pharmacistProposedBadgeLabel: proposedBadgeLabel,
                        prescriptionBadge: prescriptionBadgeForLabels,
                      }),
                      supplyAmendmentBundles,
                      treatedLineLabels: request.status === "treated",
                      sectionBucket: supplyTier,
                      labelAudience: "pharmacist",
                    })
                  : undefined;
                const supplyAvailabilityOptions = isAjoutOfficineLine
                  ? PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS
                  : PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS;

                const modifyFieldsBlock = useCompactProductLineSupplyEditor ? (
                  (() => {
                    const sentQty = pharmacistSentProductLineQtyUi({
                      draftStatus: f.availability_status,
                      availableQtyStr: f.available_qty,
                      requestedQty: draftRequestedQtyForInfer,
                      isProposedLine: isProposedForAvailInference,
                    });
                    const editorDisabled = !canEditThisRow || !isSupplyLineEditing;
                    return (
                      <div className="flex min-w-0 flex-col gap-1.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <PharmacienAvailabilityDropdown
                            appearance="sentLine"
                            rowId={row.id}
                            disabled={editorDisabled}
                            menuOpen={availabilityMenuRowId === row.id}
                            onOpenChange={(open) =>
                              setAvailabilityMenuRowId((cur) =>
                                open ? row.id : cur === row.id ? null : cur
                              )
                            }
                            draftStatus={f.availability_status}
                            requestedQty={draftRequestedQtyForInfer}
                            availableQtyStr={f.available_qty}
                            isProposedLine={isProposedForAvailInference}
                            options={supplyAvailabilityOptions}
                            onPick={(v) => setAvailabilityStatus(row, v)}
                          />
                          {sentQty.qtyEditable && canEditThisRow && isSupplyLineEditing ? (
                            <ProductRequestLineQtyPicker
                              qty={sentQty.displayQty}
                              maxQty={Math.min(10, draftStockCeilingForRow(row))}
                              appearance="neutral"
                              onSelect={(n) => setAvailableQty(row, String(n))}
                            />
                          ) : (
                            <ProductRequestLineQtyReadonly qty={sentQty.displayQty} appearance="neutral" />
                          )}
                        </div>
                        {(sentQty.inferredStatus === "to_order" ||
                          pharmacistSupplyDraftNeedsReceptionDate({
                            draftStatus: f.availability_status,
                            inferredEffectiveStatus: sentQty.inferredStatus,
                          })) &&
                        canEditThisRow ? (
                          <label className="flex min-w-0 flex-col gap-0.5">
                            <span className="text-[9px] font-medium text-muted-foreground">
                              Réception prévue
                            </span>
                            <PlannedVisitDateInput
                              valueYmd={f.expected_availability_date}
                              onChangeYmd={(v) => setReceptionDateField(row.id, v)}
                              minYmd={receptionDateMinYmd}
                              maxYmd={receptionDateMaxYmdVal}
                              disabled={editorDisabled}
                              yearDigits={4}
                              ariaLabel="Réception prévue"
                              className="max-w-xs"
                              shellClassName="block h-8 min-h-8 w-full rounded-lg border border-input bg-background px-2 py-1 text-[11px] font-semibold tabular-nums shadow-sm"
                            />
                          </label>
                        ) : null}
                        <p className="text-[10px] text-muted-foreground">
                          PU indicatif{" "}
                          <span className="font-semibold tabular-nums text-foreground">{draftIndicativePuMad}</span>
                        </p>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                      <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          Disponibilité
                        </span>
                        <PharmacienAvailabilityDropdown
                          rowId={row.id}
                          disabled={!canEditThisRow || !isSupplyLineEditing}
                          menuOpen={availabilityMenuRowId === row.id}
                          onOpenChange={(open) =>
                            setAvailabilityMenuRowId((cur) => (open ? row.id : cur === row.id ? null : cur))
                          }
                          draftStatus={f.availability_status}
                          requestedQty={
                            isOrdonnancePrincipalLine
                              ? draftRequestedQtyForInfer
                              : inferRequestedQtyForAvailability(row)
                          }
                          availableQtyStr={f.available_qty}
                          isProposedLine={isProposedLine}
                          options={supplyAvailabilityOptions}
                          onPick={(v) => setAvailabilityStatus(row, v)}
                        />
                      </div>
                      {isOrdonnancePrincipalLine ? (
                        <label className="flex w-[5.5rem] flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Qté prescrite
                          </span>
                          <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                            <button
                              type="button"
                              disabled={
                                !canEditThisRow ||
                                !isSupplyLineEditing ||
                                ordonnanceDraftRequestedQty(row, f) <= 1
                              }
                              onClick={() => {
                                const cur = ordonnanceDraftRequestedQty(row, f);
                                const applied = nudgeOrdonnanceRequestedQty(
                                  -1,
                                  cur,
                                  Number(f.available_qty) || 0,
                                  f.availability_status
                                );
                                setOrdonnanceRequestedQty(row, String(applied.requestedQty));
                              }}
                              className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Diminuer la quantité prescrite"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={!canEditThisRow || !isSupplyLineEditing}
                              value={f.requested_qty_str ?? String(row.requested_qty)}
                              onChange={(e) => setOrdonnanceRequestedQty(row, e.target.value)}
                              className="h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none"
                            />
                            <button
                              type="button"
                              disabled={
                                !canEditThisRow || !isSupplyLineEditing || ordonnanceDraftRequestedQty(row, f) >= 999
                              }
                              onClick={() => {
                                const cur = ordonnanceDraftRequestedQty(row, f);
                                const applied = nudgeOrdonnanceRequestedQty(
                                  1,
                                  cur,
                                  Number(f.available_qty) || 0,
                                  f.availability_status
                                );
                                setOrdonnanceRequestedQty(row, String(applied.requestedQty));
                              }}
                              className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Augmenter la quantité prescrite"
                            >
                              +
                            </button>
                          </div>
                        </label>
                      ) : null}
                      <label className="flex w-[5.5rem] flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          {isOrdonnancePrincipalLine ? "Qté dispo" : "Dispo"}
                        </span>
                        <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                          <button
                            type="button"
                            disabled={stockMinusDisabled || !isSupplyLineEditing}
                            onClick={() => nudgeAvailableQty(row, -1)}
                            className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Diminuer la quantité"
                          >
                            −
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            disabled={
                              !canEditThisRow ||
                              !isSupplyLineEditing ||
                              f.availability_status === "market_shortage"
                            }
                            value={f.available_qty}
                            onChange={(e) => setAvailableQty(row, e.target.value)}
                            className={clsx(
                              "h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none",
                              f.availability_status === "market_shortage" && "bg-muted text-muted-foreground",
                              f.availability_status === "to_order" &&
                                "bg-teal-50/90 font-bold text-teal-950 ring-1 ring-teal-200/80"
                            )}
                          />
                          <button
                            type="button"
                            disabled={stockPlusDisabled || !isSupplyLineEditing}
                            onClick={() => nudgeAvailableQty(row, 1)}
                            className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                            aria-label="Augmenter la quantité"
                          >
                            +
                          </button>
                        </div>
                      </label>
                      <div className="flex min-w-[5.25rem] flex-col justify-end gap-0.5 text-end sm:min-w-[6rem]">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          PU indicatif
                        </span>
                        <p
                          className="whitespace-nowrap py-2 text-[12px] font-semibold tabular-nums text-foreground"
                          title={
                            draftIndicativePuMad !== "—"
                              ? `Prix catalogue officine : ${draftIndicativePuMad}`
                              : undefined
                          }
                        >
                          {draftIndicativePuMad}
                        </p>
                      </div>
                    </div>
                    {canEditThisRow &&
                    pharmacistSupplyDraftNeedsReceptionDate({
                      draftStatus: f.availability_status,
                      inferredEffectiveStatus: effectiveAvailSupplyDraft(
                        row,
                        f,
                        request?.request_type,
                        request?.status
                      ),
                    }) ? (
                      <label className="flex max-w-sm flex-col gap-0">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Réception prévue
                        </span>
                        <PlannedVisitDateInput
                          valueYmd={f.expected_availability_date}
                          onChangeYmd={(v) => setReceptionDateField(row.id, v)}
                          minYmd={receptionDateMinYmd}
                          maxYmd={receptionDateMaxYmdVal}
                          disabled={!canEditThisRow || !isSupplyLineEditing}
                          yearDigits={4}
                          ariaLabel="Réception prévue"
                          className="sm:min-w-[9rem] sm:w-auto"
                          shellClassName="block h-7 min-h-7 w-full rounded border border-input bg-background px-1.5 py-0.5 text-[11px] font-semibold tabular-nums shadow-sm"
                        />
                      </label>
                    ) : null}
                    {canEditThisRow && isSupplyLineEditing && isOrdonnancePrincipalLine ? (
                      <p className="text-[9px] leading-snug text-amber-900/90">
                        <span className="font-semibold text-amber-950">Ordonnance · </span>
                        qté dispo ≤ prescrite (
                        <strong className="tabular-nums">{draftRequestedQtyForInfer}</strong>
                        ).
                      </p>
                    ) : null}
                  </div>
                );

                const expandedEditor = (
                  <div
                    data-pharma-supply-editor={row.id}
                    className="scroll-mt-[calc(env(safe-area-inset-top)+3.25rem)] space-y-1.5"
                  >
                    {withdrawnDraft ? (
                      <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                        {!row.withdrawn_after_confirm ? (
                          <>
                            <p className="text-[10px] leading-snug text-muted-foreground">
                              Retrait en brouillon — sera journalisé avec le dossier (« Enregistrer les modifications »).
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-semibold text-foreground hover:bg-muted/60 disabled:opacity-45"
                              onClick={() => {
                                patchItemDraft(row.id, {
                                  ...buildItemDraftFromRow(row, request.status, request.request_type),
                                  withdrawn_after_confirm: false,
                                });
                                setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                                setSupplyMenuRowId(null);
                              }}
                            >
                              Abandonner le retrait (brouillon)
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    {!withdrawnDraft && isSupplyLineEditing ? (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          className="w-full rounded-md border border-sky-400/80 bg-white px-2 py-1.5 text-[10px] font-semibold text-sky-950 hover:bg-sky-100/80 disabled:opacity-45"
                          onClick={() => {
                            patchItemDraft(row.id, buildItemDraftFromRow(row, request.status, request.request_type));
                            setSupplyEditOpenRowIds((p) => {
                              const n = { ...p };
                              delete n[row.id];
                              return n;
                            });
                            setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                            setSupplyMenuRowId(null);
                          }}
                        >
                          Restaurer cette ligne
                        </button>
                        {modifyFieldsBlock}
                      </div>
                    ) : null}
                  </div>
                );

                const counterSelectInteractive =
                  selected &&
                  showInlineCounter &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  request.status !== "completed";

                const treatedCounterSlot =
                  showInlineCounter && request.status !== "completed" && request.status !== "treated" ? (
                    <div className="border-t border-slate-100 bg-slate-50/25 px-2 py-2">
                      {!selected ? (
                        <p className="text-[10px] text-muted-foreground">
                          Patient n&apos;ayant pas retenu cette ligne après votre réponse. État au comptoir :{" "}
                          <strong className="text-foreground">
                            {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                          </strong>
                        </p>
                      ) : lineLockedTrace ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                        </p>
                      ) : lineCounterLocked ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          Récupéré — plus modifiable.
                        </p>
                      ) : (
                        <div className="flex max-w-[320px] flex-col gap-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Résultat comptoir (enregistrement global)
                          </p>
                          <label className="flex flex-col gap-0.5 text-[10px] font-normal text-muted-foreground">
                            <span className="text-[9px] font-semibold uppercase tracking-wide">État</span>
                            <PolishedOptionPicker
                              options={[
                                { value: "unset", label: "En attente" },
                                { value: "picked_up", label: "Récupéré" },
                              ]}
                              value={counterSelectKeyNormalized(row, f)}
                              disabled={!counterSelectInteractive || busy}
                              onPick={(v) => {
                                patchItemDraft(row.id, {
                                  counter_outcome_draft: v as "unset" | "picked_up",
                                  counter_cancel_reason_draft: null,
                                  counter_cancel_detail_draft: null,
                                });
                              }}
                              appearance="compact"
                              ariaLabel="État comptoir"
                            />
                          </label>
                          <p className="text-[9px] leading-snug text-muted-foreground">
                            Pour retirer une ligne du dossier validé, utilisez « Retirer la ligne » dans le menu ⋮.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null;

                return (
                  <Fragment key={row.id}>
                    <PharmacistSupplyCompactLine
                      header={header}
                      validatedName={validatedName}
                      validatedBrand={validatedBrand}
                      validatedQty={validatedQty}
                      ordonnancePrescribedQty={ordonnancePrescribedQty}
                      availSentence={availSentence}
                      unitLabel={unitLabel}
                      totalLabel={totalLabel}
                      unitPriceMad={branchPrice}
                      lineTotalMad={lineTot}
                      thumbUrl={thumbUrl}
                      descriptionHtml={productDescriptionHtmlForDisplay(
                        validatedBranchDescriptionHtml(pl)
                      )}
                      selected={selected}
                      lineLockedTrace={lineLockedTrace}
                      withdrawn={withdrawnDraft}
                      effAvailRow={effSupply}
                      canMarkReserved={canMarkReservedSupply}
                      canMarkOrdered={canMarkOrderedSupply}
                      fulfillmentDraft={f.fulfillment_draft}
                      fulfillmentActionsBusy={fulfillmentRpcBusyId === row.id}
                      onToggleReserved={() => {
                        const rowSnap = items.find((i) => i.id === row.id) ?? row;
                        const fd = draft[row.id];
                        if (!fd) return;
                        const next = fd.fulfillment_draft === "reserved" ? "unset" : "reserved";
                        void persistPostConfirmFulfillmentForRow(rowSnap, next);
                      }}
                      onToggleOrdered={() => {
                        const rowSnap = items.find((i) => i.id === row.id) ?? row;
                        const fd = draft[row.id];
                        if (!fd) return;
                        if (fd.fulfillment_draft === "arrived_reserved") {
                          void persistPostConfirmFulfillmentForRow(rowSnap, "ordered");
                          return;
                        }
                        const next = fd.fulfillment_draft === "ordered" ? "unset" : "ordered";
                        void persistPostConfirmFulfillmentForRow(rowSnap, next);
                      }}
                      onToggleArrivedReserved={() => {
                        const rowSnap = items.find((i) => i.id === row.id) ?? row;
                        const fd = draft[row.id];
                        if (!fd) return;
                        if (fd.fulfillment_draft === "arrived_reserved") {
                          void persistPostConfirmFulfillmentForRow(rowSnap, "ordered");
                        } else if (
                          fd.fulfillment_draft === "ordered" ||
                          fd.fulfillment_draft === "unset"
                        ) {
                          void persistPostConfirmFulfillmentForRow(rowSnap, "arrived_reserved");
                        }
                      }}
                      canShowArrivedReservedPill={canShowArrivedReservedPill}
                      canMarkPickedUpCounterSupply={canMarkPickedUpCounterSupply}
                      counterPickupActive={(row.counter_outcome ?? "unset") === "picked_up"}
                      onMarkPickedUpCounter={() => {
                        const co = row.counter_outcome ?? "unset";
                        void saveCounterOutcome(row.id, co === "picked_up" ? "unset" : "picked_up");
                      }}
                      counterOutcomeBusy={counterBusyId === row.id}
                      hasModifyConsent={isSupplyLineEditing}
                      busy={busy}
                      supplyConfirmBusy={false}
                      lineCounterLocked={lineCounterLocked}
                      showExpandedEditor={
                        Boolean(canManageSupply) &&
                        selected &&
                        !lineLockedTrace &&
                        !lineCounterLocked &&
                        request.status !== "completed" &&
                        (withdrawnDraft || isSupplyLineEditing)
                      }
                      supplyMutationsEnabled={Boolean(canManageSupply) && !isPendingLocalAdd}
                      onRemovePendingAdd={
                        isPendingLocalAdd
                          ? () => void removePharmacistProposedLine(row)
                          : undefined
                      }
                      expandedEditor={expandedEditor}
                      hidePostConfirmFulfillmentPills={request.status === "treated"}
                      compactTreatedActions={request.status === "treated"}
                      treatedCounterSlot={treatedCounterSlot}
                      lineMessageButton={
                        <PharmacistLineMessageButton
                          visual={lineConvoVisual}
                          open={lineConvoRowId === row.id}
                          disabled={
                            busy || fulfillmentRpcBusyId === row.id
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            setSupplyMenuRowId(null);
                            setLineConvoRowId(row.id);
                          }}
                        />
                      }
                      postConfirmAmendmentBadges={supplyAmendmentBadgeLabelsByItemId[row.id]}
                      menuOpen={supplyMenuRowId === row.id}
                      onMenuOpenChange={(open) => setSupplyMenuRowId(open ? row.id : null)}
                      onMenuModify={() => {
                        if (withdrawnDraft) {
                          setError(
                            "Abandonnez d’abord le retrait en brouillon (bouton sous la ligne), puis modifiez."
                          );
                          setSupplyMenuRowId(null);
                          return;
                        }
                        setSupplyEditOpenRowIds((p) => ({ ...p, [row.id]: true }));
                        setSupplyMenuRowId(null);
                        window.requestAnimationFrame(() => {
                          document
                            .querySelector(`[data-pharma-supply-editor="${row.id}"]`)
                            ?.scrollIntoView({ behavior: "smooth", block: "center" });
                        });
                      }}
                      onMenuWithdraw={() => {
                        setError("");
                        patchItemDraft(row.id, {
                          ...buildItemDraftFromRow(row, request.status, request.request_type),
                          withdrawn_after_confirm: true,
                        });
                        setSupplyEditOpenRowIds((p) => {
                          const n = { ...p };
                          delete n[row.id];
                          return n;
                        });
                        setSupplyMenuRowId(null);
                      }}
                      showAjoutOfficineBadge={isAjoutOfficineLine}
                      ajoutOfficineBadgeLabel={ajoutOfficineBadgeLabel}
                      lineOriginBadgeLabel={compactOriginBadgeLabel}
                      lineOriginBadgeTone={compactOriginBadgeTone}
                      onMenuHistory={() => setPharmaHistoryRowId(row.id)}
                      withdrawDisabled={lineCounterLocked}
                      withdrawDisabledReason={
                        lineCounterLocked ? "Ligne déjà enregistrée comme récupérée." : null
                      }
                      supplyTier={supplyTier}
                      validatedLineLabels={validatedLineLabels}
                      onPhotoPreview={bucket ? openProductPhotoPreview : undefined}
                    />
                  </Fragment>
                );
              }

              return (
                <Fragment key={row.id}>
                  {header ? (
                    <li className={clsx("list-none", entryIdx > 0 && "mt-2 pt-4")}>
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
                    </li>
                  ) : null}
                  <li
                    className={clsx(
                      usePharmaSentLineLayout
                        ? clsx(PRODUCT_REQUEST_LINE_CARD_SHELL, "list-none overflow-visible border-l-[3px]")
                        : PHARMA_LINE_EDITOR_CARD,
                      "list-none overflow-visible",
                      usePharmaSentLineLayout && isProposedLine && "mx-auto w-full max-w-md",
                      !usePharmaSentLineLayout && isAjoutOfficineLine && "border-l-[3px] border-l-violet-500/70",
                      !usePharmaSentLineLayout && isOrdonnancePrincipalLine && "border-l-[3px] border-l-amber-500/70",
                      !usePharmaSentLineLayout &&
                        !isAjoutOfficineLine &&
                        !isOrdonnancePrincipalLine &&
                        "border-l-[3px] border-l-sky-500/60",
                      usePharmaSentLineLayout &&
                        !isProposedLine &&
                        (isOrdonnancePrincipalLine || isOrdonnancePharmacistLine
                          ? "border-l-amber-500/65"
                          : "border-l-sky-500/65"),
                      usePharmaSentLineLayout && isProposedLine && "border-l-violet-500/65"
                    )}
                  >
                  {showVariantTabs ? (
                    <>
                      <PharmacistLineAlternativesTabs
                        principalTabLabel={
                          isProposedLine
                            ? "Proposé"
                            : isOrdonnancePrincipalLine
                              ? "Ordonnance"
                              : "Demandé"
                        }
                        tabs={[
                          ...rowAlts.map((alt, altIndex) => ({
                            id: alt.id,
                            label: pharmacistAltTabLabel(one(alt.products)?.name ?? null, altIndex + 1),
                          })),
                        ]}
                        activeTab={activeAltTab}
                        onTabChange={(tabId) => {
                          setLineAltTabByRowId((prev) => ({ ...prev, [row.id]: tabId }));
                          if (tabId === PHARMACIST_ALT_TAB_ADD) {
                            setAltPickerOpenFor(row.id);
                            setAltQuery("");
                            setAltHits([]);
                          } else if (tabId !== "principal") {
                            resetAltPicker(row.id);
                          }
                        }}
                        canAddAlt={canEditThisRow && rowAlts.length < 3}
                        onAddAlt={() => {
                          setLineAltTabByRowId((prev) => ({ ...prev, [row.id]: PHARMACIST_ALT_TAB_ADD }));
                          setAltPickerOpenFor(row.id);
                          setAltQuery("");
                          setAltHits([]);
                        }}
                        addBusy={altBusyRow === row.id}
                        altCount={rowAlts.length}
                      />
                      {showAltPicker && altPickerOpenFor === row.id ? (
                        <PharmacistAltCatalogPicker
                          query={altQuery}
                          onQueryChange={setAltQuery}
                          hits={altVisibleHits}
                          debouncedLen={altDebounced.length}
                          busy={altBusyRow === row.id}
                          onSelect={(h) => void insertAlternative(row, h)}
                          onClose={() => resetAltPicker(row.id)}
                          pricingConfig={pricingConfig}
                          onPhotoPreview={openProductPhotoPreview}
                        />
                      ) : null}
                    </>
                  ) : null}

                  {showPrincipalVariant ? (
                  <>
                  <div className={PHARMA_LINE_EDITOR_HEADER}>
                    <div className="flex w-[4.25rem] shrink-0 flex-col items-stretch gap-0.5 sm:w-[4.75rem]">
                      <div className="relative size-[3.65rem] w-full overflow-hidden rounded-md border border-border/80 bg-card sm:size-[3.85rem]">
                        <PharmacistProductPhotoThumb
                          photoUrl={
                            lineEditorPhotoPath
                              ? resolvePublicMediaUrl(lineEditorPhotoPath) ?? lineEditorPhotoPath
                              : null
                          }
                          title={prod?.name ?? "Produit"}
                          descriptionHtml={prod?.full_description}
                          onPhotoPreview={openProductPhotoPreview}
                          iconClassName={clsx(
                            "size-7 sm:size-8",
                            isAjoutOfficineLine || isConsultation
                              ? "text-violet-400/90"
                              : isOrdonnancePrincipalLine
                                ? "text-amber-500/90"
                                : "text-slate-400"
                          )}
                        />
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "min-w-0 flex-1",
                        isProductRequestSent ||
                        isPrescriptionWorkflowSent ||
                        isConsultationWorkflowSent
                          ? "space-y-1.5"
                          : "space-y-0.5"
                      )}
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                          {prod?.name ?? "Produit"}
                        </p>
                        <ProductBrandLabel brand={prod?.brand} />
                        {lineProposedBadge ? (
                          <span
                            className={clsx(
                              "inline-flex w-fit max-w-full rounded-full border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide",
                              isOrdonnancePharmacistLine || isOrdonnancePrincipalLine
                                ? "border-amber-300/70 bg-amber-50/40 text-amber-900/90"
                                : "border-violet-300/70 bg-violet-50/50 text-violet-900"
                            )}
                          >
                            {lineProposedBadge}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                          {!usePharmaSentLineLayout ? (
                            <span
                              className={clsx(
                                "inline-flex max-w-full items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1",
                                availUi.badgeClass
                              )}
                              title={availUi.label}
                            >
                              <AvailIcon className="size-3 shrink-0" aria-hidden />
                              <span className="truncate">{availUi.label}</span>
                            </span>
                          ) : null}
                          {!isProposedLine || isOrdonnancePharmacistLine ? (
                            <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                              <Package className="size-3 text-muted-foreground/80" aria-hidden />
                              <span>
                                {isOrdonnancePharmacistLine ? "Prescrit" : "Demandé"}{" "}
                                <strong className="text-foreground">
                                  {isOrdonnancePharmacistLine
                                    ? f.requested_qty_str?.trim() || row.requested_qty
                                    : row.requested_qty}
                                </strong>
                              </span>
                            </span>
                          ) : null}
                          <span
                            className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap tabular-nums"
                            title={
                              draftIndicativePuMad !== "—"
                                ? `Prix catalogue officine : ${draftIndicativePuMad}`
                                : undefined
                            }
                          >
                            <span className="text-[8px] font-bold uppercase tracking-wide text-muted-foreground">
                              PU{" "}
                            </span>
                            <span className="text-[11px] font-semibold text-foreground sm:text-[12px]">
                              {draftIndicativePuMad}
                            </span>
                          </span>
                          {lineLockedTrace ? (
                            <span className="rounded-md bg-rose-100 px-1.5 py-px text-[9px] font-semibold text-rose-900 ring-1 ring-rose-200/80">
                              Non distribué
                            </span>
                          ) : [
                              "confirmed",
                              "treated",
                              "completed",
                              "partially_collected",
                              "fully_collected",
                            ].includes(request.status) ? (
                            selected ? (
                              <span className="rounded-md bg-emerald-100 px-1.5 py-px text-[9px] font-semibold text-emerald-900">
                                Retenu
                              </span>
                            ) : (
                              <span className="rounded-md bg-slate-100 px-1.5 py-px text-[9px] font-semibold text-slate-700">
                                Non retenu
                              </span>
                            )
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5 self-end">
                          <PharmacistLineMessageButton
                            visual={lineConvoVisual}
                            open={lineConvoEffectiveRowId === row.id}
                            disabled={busy}
                            appearance={usePharmaSentLineLayout ? "neutral" : "default"}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLineConvoRowId((cur) => (cur === row.id ? null : row.id));
                            }}
                          />
                          {canEditThisRow &&
                          (isProposedLine ||
                            (respondedEditMode &&
                              isOrdonnancePrincipalLine &&
                              request?.status === "responded")) ? (
                            <button
                              type="button"
                              title={
                                isOrdonnancePrincipalLine
                                  ? "Retirer cette ligne"
                                  : "Retirer cette proposition"
                              }
                              aria-label={
                                isOrdonnancePrincipalLine
                                  ? "Retirer cette ligne"
                                  : "Retirer cette proposition"
                              }
                              disabled={busy}
                              onClick={() => void removePharmacistProposedLine(row)}
                              className="shrink-0 rounded-lg border border-rose-200/90 bg-rose-50/90 p-1.5 text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                            >
                              <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {isProposedLine && !isOrdonnancePrincipalLine && !isConsultation ? (
                        <p className="rounded-md border border-violet-300/80 bg-gradient-to-br from-violet-200/55 to-violet-100/40 px-2 py-1 text-[10px] leading-snug text-violet-950 shadow-sm ring-1 ring-violet-300/35">
                          {row.pharmacist_proposal_reason?.trim() ? (
                            <>
                              <span className="font-semibold text-violet-950">Motif · </span>
                              <span className="text-violet-950/92">{row.pharmacist_proposal_reason.trim()}</span>
                            </>
                          ) : (
                            <span className="italic text-violet-800/85">Aucun motif renseigné.</span>
                          )}
                        </p>
                      ) : null}
                      {showPatientConfirmedChoice ? (
                        <div className="rounded-md border border-sky-200/70 bg-sky-50/80 px-1.5 py-1 text-[10px] text-sky-950">
                          <p className="font-medium leading-snug">
                            {chosenAltRow ? (
                              <>
                                Alt. <strong>{one(chosenAltRow.products)?.name ?? "—"}</strong>
                              </>
                            ) : (
                              <>
                                Retenu <strong>{prod?.name ?? "Produit"}</strong>
                              </>
                            )}
                            <span className="text-sky-800/85">
                              {" "}
                              · qté <strong>{row.selected_qty ?? row.requested_qty}</strong>
                            </span>
                          </p>
                          {chosenAltId && !chosenAltRow ? (
                            <p className="mt-1 text-[10px] text-amber-900/90">
                              Réf. alternative en base introuvable dans la liste affichée — vérifiez les alternatives de la ligne.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {canManageSupply &&
                      selected &&
                      !lineLockedTrace &&
                      request.status !== "completed" &&
                      !row.withdrawn_after_confirm ? (
                        <div className="flex flex-wrap gap-1.5 rounded-md border border-amber-400/85 bg-amber-50/80 px-1.5 py-1 text-[10px] text-amber-950 shadow-sm ring-1 ring-amber-200/55">
                          <button
                            type="button"
                            disabled={!canEditThisRow || busy}
                            onClick={() => {
                              setError("");
                              patchItemDraft(row.id, {
                                ...buildItemDraftFromRow(row, request.status, request.request_type),
                                withdrawn_after_confirm: true,
                              });
                              setSupplyEditOpenRowIds((p) => {
                                const n = { ...p };
                                delete n[row.id];
                                return n;
                              });
                            }}
                            className="rounded-md border border-amber-600/90 bg-white px-2 py-1 text-[10px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                          >
                            Retirer la ligne
                          </button>
                        </div>
                      ) : null}
                      {canManageSupply && selected && !lineLockedTrace && withdrawnDraft ? (
                        <p className="mt-1 rounded-md border border-border/80 bg-muted/25 px-1.5 py-1 text-[10px] leading-snug text-muted-foreground">
                          Ligne retirée — pastilles réservé / commandé désactivées pour cette ligne.
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {lineLockedTrace ? (
                    <div className="space-y-1.5 border-t border-rose-200/50 bg-rose-50/20 px-2 py-1.5 text-[10px] leading-snug text-foreground">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-rose-950">
                        Lecture seule · {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                      </p>
                      {row.counter_cancel_detail ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Détail : </span>
                          {row.counter_cancel_detail}
                        </p>
                      ) : null}
                      <p>
                        <span className="text-muted-foreground">Dispo renseignée : </span>
                        <strong>{row.availability_status ? availabilityStatusFr[row.availability_status] : "—"}</strong>
                        {row.availability_status === "to_order" && row.expected_availability_date ? (
                          <span className="text-muted-foreground"> · Prévu le {row.expected_availability_date}</span>
                        ) : null}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Qté disponible : </span>
                        <strong>{row.available_qty != null ? row.available_qty : "—"}</strong>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Prix MAD : </span>
                        <strong>{row.unit_price != null ? Number(row.unit_price).toFixed(2) : "—"}</strong>
                      </p>
                      {row.pharmacist_comment ? (
                        <p className="whitespace-pre-wrap text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Note enregistrée : </span>
                          {row.pharmacist_comment}
                        </p>
                      ) : null}
                    </div>
                  ) : showLineAndPublishEdits || (usePharmaSentLineLayout && respondedFrozenView) ? (
                    usePharmaSentLineLayout ? (
                      (() => {
                        const sentQty = pharmacistSentProductLineQtyUi({
                          draftStatus: f.availability_status,
                          availableQtyStr: f.available_qty,
                          requestedQty: draftRequestedQtyForInfer,
                          isProposedLine: isProposedForAvailInference,
                        });
                        return (
                          <div className="flex min-w-0 flex-col gap-1.5 border-t border-border/50 px-2 py-2 sm:px-2.5">
                            <div className="flex min-w-0 items-center gap-2">
                              <PharmacienAvailabilityDropdown
                                appearance="sentLine"
                                readOnlyEmphasis={respondedFrozenView}
                                rowId={row.id}
                                disabled={!canEditThisRow}
                                menuOpen={availabilityMenuRowId === row.id}
                                onOpenChange={(open) =>
                                  setAvailabilityMenuRowId((cur) =>
                                    open ? row.id : cur === row.id ? null : cur
                                  )
                                }
                                draftStatus={f.availability_status}
                                requestedQty={draftRequestedQtyForInfer}
                                availableQtyStr={f.available_qty}
                                isProposedLine={isProposedForAvailInference}
                                options={availabilityOptions}
                                onPick={(v) => setAvailabilityStatus(row, v)}
                              />
                              {sentQty.qtyEditable && canEditThisRow ? (
                                <ProductRequestLineQtyPicker
                                  qty={sentQty.displayQty}
                                  maxQty={Math.min(10, draftStockCeilingForRow(row))}
                                  appearance="neutral"
                                  onSelect={(n) => setAvailableQty(row, String(n))}
                                />
                              ) : (
                                <ProductRequestLineQtyReadonly qty={sentQty.displayQty} appearance="neutral" />
                              )}
                            </div>
                            {sentQty.inferredStatus === "to_order" ||
                            f.availability_status === "to_order" ? (
                              <label className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-[9px] font-medium text-muted-foreground">
                                  Réception prévue
                                </span>
                                <PlannedVisitDateInput
                                  valueYmd={f.expected_availability_date}
                                  onChangeYmd={(v) => setReceptionDateField(row.id, v)}
                                  minYmd={receptionDateMinYmd}
                                  maxYmd={receptionDateMaxYmdVal}
                                  disabled={!canEditThisRow}
                                  yearDigits={4}
                                  ariaLabel="Réception prévue"
                                  className="max-w-xs"
                                  shellClassName="block h-8 min-h-8 w-full rounded-lg border border-input bg-background px-2 py-1 text-[11px] font-semibold tabular-nums shadow-sm"
                                />
                              </label>
                            ) : null}
                          </div>
                        );
                      })()
                    ) : (
                    <div className={clsx(PHARMA_LINE_EDITOR_CONTROLS, "space-y-1.5")}>
                      <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                        <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Dispo</span>
                          <PharmacienAvailabilityDropdown
                            rowId={row.id}
                            disabled={!canEditThisRow}
                            menuOpen={availabilityMenuRowId === row.id}
                            onOpenChange={(open) =>
                              setAvailabilityMenuRowId((cur) =>
                                open ? row.id : cur === row.id ? null : cur
                              )
                            }
                            draftStatus={f.availability_status}
                            requestedQty={draftRequestedQtyForInfer}
                            availableQtyStr={f.available_qty}
                            isProposedLine={isAjoutOfficineLine}
                            options={availabilityOptions}
                            onPick={(v) => setAvailabilityStatus(row, v)}
                          />
                        </div>
                        {isOrdonnancePharmacistLine ? (
                          <label className="flex w-[5.5rem] flex-col gap-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                              Qté prescrite
                            </span>
                            <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                              <button
                                type="button"
                                disabled={
                                  !canEditThisRow ||
                                  (parseInt(f.requested_qty_str ?? String(row.requested_qty), 10) || 1) <= 1
                                }
                                onClick={() => {
                                  const cur = ordonnanceDraftRequestedQty(row, f);
                                  const applied = nudgeOrdonnanceRequestedQty(
                                    -1,
                                    cur,
                                    Number(f.available_qty) || 0,
                                    f.availability_status
                                  );
                                  setOrdonnanceRequestedQty(row, String(applied.requestedQty));
                                }}
                                className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                                aria-label="Diminuer la quantité prescrite"
                              >
                                −
                              </button>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={!canEditThisRow}
                                value={f.requested_qty_str ?? String(row.requested_qty)}
                                onChange={(e) => setOrdonnanceRequestedQty(row, e.target.value)}
                                className="h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none"
                              />
                              <button
                                type="button"
                                disabled={!canEditThisRow || ordonnanceDraftRequestedQty(row, f) >= 999}
                                onClick={() => {
                                  const cur = ordonnanceDraftRequestedQty(row, f);
                                  const applied = nudgeOrdonnanceRequestedQty(
                                    1,
                                    cur,
                                    Number(f.available_qty) || 0,
                                    f.availability_status
                                  );
                                  setOrdonnanceRequestedQty(row, String(applied.requestedQty));
                                }}
                                className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                                aria-label="Augmenter la quantité prescrite"
                              >
                                +
                              </button>
                            </div>
                          </label>
                        ) : null}
                        <label className="flex w-[5.5rem] flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            {isOrdonnancePharmacistLine
                              ? "Qté dispo"
                              : isPrescriptionExtraProposed || isConsultation
                                ? "Qté proposée"
                                : "Dispo"}
                          </span>
                          <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                            <button
                              type="button"
                              disabled={stockMinusDisabled}
                              onClick={() => nudgeAvailableQty(row, -1)}
                              className="h-full w-8 border-r border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Diminuer la quantité"
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              disabled={!canEditThisRow || f.availability_status === "market_shortage"}
                              value={f.available_qty}
                              onChange={(e) => setAvailableQty(row, e.target.value)}
                              className={clsx(
                                "h-full w-full min-w-[2rem] border-0 bg-transparent px-1 text-center text-[12px] font-semibold tabular-nums focus:outline-none",
                                f.availability_status === "market_shortage" && "bg-muted text-muted-foreground",
                                f.availability_status === "to_order" &&
                                  "bg-teal-50/90 font-bold text-teal-950 ring-1 ring-teal-200/80"
                              )}
                            />
                            <button
                              type="button"
                              disabled={stockPlusDisabled}
                              onClick={() => nudgeAvailableQty(row, 1)}
                              className="h-full w-8 border-l border-input text-sm font-bold text-muted-foreground disabled:opacity-50"
                              aria-label="Augmenter la quantité"
                            >
                              +
                            </button>
                          </div>
                        </label>
                      </div>
                      {f.availability_status === "to_order" ? (
                        <label className="flex max-w-md flex-col gap-1 rounded-lg border border-teal-200/80 bg-teal-50/40 p-2">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-teal-950">
                            Réception prévue
                          </span>
                          <PlannedVisitDateInput
                            valueYmd={f.expected_availability_date}
                            onChangeYmd={(v) => setReceptionDateField(row.id, v)}
                            minYmd={receptionDateMinYmd}
                            maxYmd={receptionDateMaxYmdVal}
                            disabled={!canEditThisRow}
                            yearDigits={4}
                            ariaLabel="Réception prévue"
                            className="sm:min-w-[11rem]"
                            shellClassName="block h-10 min-h-10 w-full rounded-lg border-2 border-teal-300/80 bg-white px-2 py-1 text-[13px] font-semibold tabular-nums shadow-inner"
                          />
                        </label>
                      ) : null}
                    </div>
                    )
                  ) : (
                    <div className="border-t border-slate-100/90 bg-slate-50/30 px-3 py-2.5">
                      <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                        {respondedFrozenView
                          ? "Réponse publiée · lecture seule"
                          : "Lecture seule · dossier non modifiable"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px] font-medium shadow-sm tabular-nums">
                          <Package className="size-3.5 shrink-0 self-center text-muted-foreground" aria-hidden />
                          <span className="text-muted-foreground">Qté</span>
                          <strong>{row.available_qty != null ? row.available_qty : "—"}</strong>
                        </span>
                        <span className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-xl border border-border/70 bg-background px-2 py-1 text-[11px] font-medium shadow-sm tabular-nums">
                          <span className="text-[10px] text-muted-foreground">MAD</span>
                          <strong>{row.unit_price != null ? Number(row.unit_price).toFixed(2) : "—"}</strong>
                        </span>
                        {row.availability_status === "to_order" && row.expected_availability_date ? (
                          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200/80 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950">
                            <CalendarClock className="size-3.5 shrink-0" aria-hidden />
                            {formatDateShortFr(row.expected_availability_date)}
                          </span>
                        ) : null}
                      </div>
                      {respondedFrozenView && rowAlts.length > 0 ? (
                        <div className="mt-2 border-t border-teal-200/50 pt-2">
                          <p className="text-[9px] font-bold uppercase tracking-wide text-teal-900">
                            Alternatives ({rowAlts.length})
                          </p>
                          <ul className="mt-1 space-y-1">
                            {rowAlts.map((alt) => {
                              const an = one(alt.products)?.name ?? "Alternative";
                              const aq = clampAlternativeAvailableQty(
                                Number(alt.available_qty ?? row.requested_qty)
                              );
                              const ast = alt.availability_status ?? "—";
                              const alab = availabilityStatusFr[ast] ?? ast;
                              const aeta =
                                ast === "to_order" && alt.expected_availability_date?.trim()
                                  ? formatDateShortFr(alt.expected_availability_date.trim())
                                  : null;
                              const ap = catalogPriceMadLabel(
                                pricingConfig,
                                one(alt.products),
                                alt.product_id,
                                alt.unit_price
                              );
                              return (
                                <li
                                  key={alt.id}
                                  className="rounded-lg border border-teal-200/60 bg-white/80 px-2 py-1 text-[10px] text-teal-950"
                                >
                                  <span className="font-semibold">{an}</span>
                                  <span className="mt-0.5 block text-[9px] text-teal-800/90">
                                    {alab} · qté <strong>{aq}</strong>
                                    {aeta ? (
                                      <>
                                        {" "}
                                        · réception <strong>{aeta}</strong>
                                      </>
                                    ) : null}
                                    {" · "}
                                    {ap}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                  </>
                  ) : null}

                  {!showAltPicker && activeAltRow ? (
                    <PharmacistAlternativeLinePanel
                      alt={activeAltRow}
                      readOnly={!canEditThisRow}
                      useQtyPicker={usePharmaSentLineLayout}
                      qtyBusy={altBusyRow === activeAltRow.id}
                      qtyValue={
                        isLocalAltId(activeAltRow.id)
                          ? String(activeAltRow.available_qty ?? 1)
                          : altQtyDrafts[activeAltRow.id] ?? String(activeAltRow.available_qty ?? row.requested_qty)
                      }
                      onQtyChange={(v) => {
                        if (isLocalAltId(activeAltRow.id)) patchPendingAlternativeQty(activeAltRow.id, v);
                        else setAltQtyDrafts((d) => ({ ...d, [activeAltRow.id]: v }));
                      }}
                      onQtyNudge={(delta) => {
                        if (isLocalAltId(activeAltRow.id)) {
                          const cur = clampAlternativeAvailableQty(Number(activeAltRow.available_qty ?? 1));
                          patchPendingAlternativeQty(
                            activeAltRow.id,
                            String(clampAlternativeAvailableQty(cur + delta))
                          );
                        } else {
                          const cur = clampAlternativeAvailableQty(
                            Number(altQtyDrafts[activeAltRow.id] ?? activeAltRow.available_qty ?? row.requested_qty)
                          );
                          setAltQtyDrafts((d) => ({
                            ...d,
                            [activeAltRow.id]: String(clampAlternativeAvailableQty(cur + delta)),
                          }));
                        }
                      }}
                      onRemove={() => void deleteAlternativeRow(activeAltRow.id, row.id)}
                      removeBusy={altBusyRow === activeAltRow.id}
                      pricingConfig={pricingConfig}
                      patientChoseThis={
                        request.status === "confirmed" &&
                        selected &&
                        row.patient_chosen_alternative_id === activeAltRow.id
                      }
                      onPhotoPreview={openProductPhotoPreview}
                      showIndicatif={
                        request.status === "confirmed" &&
                        selected &&
                        rowAlts.length > 0 &&
                        row.patient_chosen_alternative_id !== activeAltRow.id
                      }
                    />
                  ) : null}

                  {showInlineCounter ? (
                    <div className="border-t border-slate-100 bg-slate-50/25 px-3 py-2">
                      {!selected ? (
                        <p className="text-[10px] text-muted-foreground">
                          Patient n&apos;ayant pas retenu cette ligne après votre réponse. État au comptoir :{" "}
                          <strong className="text-foreground">
                            {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                          </strong>
                        </p>
                      ) : co === "cancelled_at_counter" ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          {counterOutcomeLabelPharmacien(co, row.counter_cancel_reason)}
                        </p>
                      ) : (row.counter_outcome ?? "unset") === "picked_up" ? (
                        <p className="text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Comptoir : </span>
                          Récupéré — plus modifiable.
                        </p>
                      ) : (
                        <div className="flex max-w-[320px] flex-col gap-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Résultat comptoir
                          </p>
                          <label className="flex flex-col gap-0.5 text-[10px] font-normal text-muted-foreground">
                            <span className="text-[9px] font-semibold uppercase tracking-wide">État</span>
                            <PolishedOptionPicker
                              options={[
                                { value: "unset", label: "En attente" },
                                { value: "picked_up", label: "Récupéré" },
                              ]}
                              value={counterSelectKeyNormalized(
                                row,
                                draft[row.id] ?? buildItemDraftFromRow(row, request.status, request.request_type)
                              )}
                              disabled={outcomeSelectDisabled}
                              onPick={(v) => {
                                void saveCounterOutcome(row.id, v as "unset" | "picked_up", null, null);
                              }}
                              appearance="compact"
                              ariaLabel="État comptoir"
                            />
                          </label>
                          {counterBusyId === row.id ? (
                            <span className="text-[10px] text-muted-foreground">Enregistrement…</span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                  </li>
                </Fragment>
              );
              })}
                </ul>
                  );
                  if (bucket) {
                    return (
                      <div
                        key={bucket.kind}
                        className={clsx("w-full min-w-0", gi > 0 && "border-t border-border/40 pt-3")}
                      >
                        <PharmacistValidatedBucketSection
                          group={bucket}
                          isTreatedView={request.status === "treated"}
                        >
                          {listBody}
                        </PharmacistValidatedBucketSection>
                      </div>
                    );
                  }
                  return (
              <div
                key={gi}
                className={clsx("w-full min-w-0", gi > 0 && "border-t border-border/40 pt-3")}
              >
                {listBody}
              </div>
                  );
                })}
              </>
            ) : null}
          </div>
              </>
              ) : null}
            </>
          ) : null}

          {isPrescription &&
          prescriptionPaths?.page1 &&
          !ordonnanceCatalogEditable &&
          !showClosedBucketsLayout &&
          !showArchiveFrozenProducts ? (
            <PrescriptionScanCollapsible
              id="prescription-scan-panel"
              className="mt-3"
              paths={prescriptionPaths}
              defaultOpen={false}
            />
          ) : null}

          {showLineAndPublishEdits ? (
            <section
              className={clsx(
                "mt-2 flex min-h-0 flex-col rounded-xl px-2 py-1.5 shadow-sm sm:px-2.5 sm:py-2",
                (isProductRequestSent ||
                  isProductRequestValidated ||
                  isConsultationWorkflowSent ||
                  isConsultationValidated) &&
                  "mx-auto w-full max-w-md",
                isPrescription
                  ? "border border-amber-300/70 bg-gradient-to-br from-amber-50/80 via-orange-50/25 to-white ring-1 ring-amber-300/35"
                  : "border border-violet-300/70 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/35 to-white ring-1 ring-violet-300/35"
              )}
            >
              {consultationProposeFormAlwaysOpen ? (
                <div className="rounded-lg bg-white/90 px-2 py-2 ring-1 ring-violet-200/55 sm:px-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-950">
                    {workflowCopy.pharmacistProposeSectionTitle}
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-violet-900/85 sm:text-[11px]">
                    {workflowCopy.pharmacistProposeSectionSubtitle}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  aria-expanded={propOpen}
                  onClick={() => {
                    if (!propOpen && canManageSupply) {
                      openPostConfirmAddPreface("proposed");
                      return;
                    }
                    const next = !propOpen;
                    setPropOpen(next);
                    setError("");
                    if (next) {
                      resetPropForm();
                    }
                  }}
                  className={clsx(
                    "flex w-full min-h-11 items-start justify-between gap-2 rounded-lg bg-white/90 px-2 py-2 text-left shadow-sm transition sm:min-h-0 sm:items-center sm:px-2.5",
                    isPrescription
                      ? "ring-1 ring-amber-200/55 hover:bg-amber-50/60"
                      : "ring-1 ring-violet-200/55 hover:bg-violet-50/60"
                  )}
                >
                  <span className="min-w-0">
                    <span
                      className={clsx(
                        "block text-[10px] font-bold uppercase tracking-wide",
                        isPrescription ? "text-amber-950" : "text-violet-950"
                      )}
                    >
                      {isPrescription ? "Produits proposés" : workflowCopy.pharmacistProposeSectionTitle}
                    </span>
                    <span
                      className={clsx(
                        "mt-0.5 block text-[10px] leading-snug sm:text-[11px]",
                        isPrescription ? "text-amber-900/85" : "text-violet-900/85"
                      )}
                    >
                      {isPrescription
                        ? "En complément des produits saisis depuis l’ordonnance."
                        : workflowCopy.pharmacistProposeSectionSubtitle}
                    </span>
                  </span>
                  <ChevronDown
                    className={clsx(
                      "mx-px size-6 shrink-0 transition-transform sm:size-5",
                      isPrescription ? "text-amber-700" : "text-violet-700",
                      propOpen && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>
              )}
              {propOpen || consultationProposeFormAlwaysOpen ? (
                <div className="mt-2 max-h-[min(56svh,28rem)] touch-pan-y space-y-2 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                  {!isConsultation ? (
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Motif
                      <textarea
                        rows={2}
                        value={propReason}
                        onChange={(e) => setPropReason(e.target.value.slice(0, 1000))}
                        placeholder="Motif visible client"
                        className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                      />
                    </label>
                  ) : null}
                  {isProductRequestSent || isPrescription || isConsultation ? (
                    <p className="text-[10px] leading-snug text-muted-foreground">
                      Disponibilité et quantité se règlent sur la carte du produit après ajout (1 à 10).
                    </p>
                  ) : (
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Quantité
                      <div className="mt-1 flex h-8 w-32 items-center overflow-hidden rounded-md border border-input bg-background">
                        <button
                          type="button"
                          onClick={() => setPropQty((q) => String(Math.max(1, (parseInt(q, 10) || 1) - 1)))}
                          className="h-full w-7 border-r border-input text-xs font-bold text-muted-foreground"
                          aria-label="Diminuer la quantité proposée"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={propQty}
                          onChange={(e) => setPropQty(e.target.value.replace(/[^\d]/g, ""))}
                          className="h-full w-full border-0 px-2 text-xs tabular-nums focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPropQty((q) =>
                              String(
                                Math.min(
                                  PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
                                  (parseInt(q, 10) || 1) + 1
                                )
                              )
                            )
                          }
                          className="h-full w-7 border-l border-input text-xs font-bold text-muted-foreground"
                          aria-label="Augmenter la quantité proposée"
                        >
                          +
                        </button>
                      </div>
                    </label>
                  )}
                  {request && ["confirmed", "treated"].includes(request.status) && !isPrescription ? (
                    <div className="space-y-2 rounded-lg border border-violet-200/60 bg-violet-50/40 p-2">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Disponibilité (avant enregistrement)
                        <div className="mt-1">
                          <PolishedOptionPicker
                            options={PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
                            value={propAvailability}
                            onPick={setPropAvailability}
                            ariaLabel="Disponibilité avant enregistrement"
                          />
                        </div>
                      </label>
                      {propAvailability === "to_order" ? (
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Date prévisionnelle
                          <PlannedVisitDateInput
                            valueYmd={propExpectedDate}
                            onChangeYmd={setPropExpectedDate}
                            minYmd={receptionDateMinYmd}
                            maxYmd={receptionDateMaxYmdVal}
                            yearDigits={4}
                            ariaLabel="Date prévisionnelle"
                            className="mt-1 w-full"
                            shellClassName="block min-h-[2rem] w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs font-semibold tabular-nums"
                          />
                        </label>
                      ) : null}
                      <p className="text-[10px] leading-snug text-violet-900/85">
                        Le produit apparaît en brouillon sur la demande : vérifiez qté et dispo sur la ligne, puis
                        « Enregistrer les modifications ».
                      </p>
                    </div>
                  ) : null}
                  <div className="relative">
                    <Search
                      className={clsx(
                        "pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2",
                        "text-violet-600"
                      )}
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={propQuery}
                      onChange={(e) => setPropQuery(e.target.value)}
                      placeholder="Rechercher dans le catalogue (2 caractères min.)"
                      className={clsx(
                        "h-11 w-full rounded-xl border-2 bg-white py-2 pl-10 pr-3 text-[13px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
                        "border-violet-400/70 ring-violet-200/50 focus-visible:ring-violet-500/35"
                      )}
                    />
                  </div>
                  {propAvailability === "to_order" &&
                  request &&
                  ["confirmed", "treated"].includes(request.status) &&
                  !propExpectedDate.trim() &&
                  propDebounced.length >= PRODUCT_CATALOG_SEARCH_MIN_CHARS ? (
                    <p className="rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[11px] leading-snug text-amber-950">
                      Choisissez d&apos;abord la date de réception prévue, puis le produit dans la liste.
                    </p>
                  ) : null}
                  {propVisibleHits.length > 0 ? (
                    <ul className="space-y-0.5 rounded-md border border-border/60 bg-muted/20 p-1">
                      {propVisibleHits.map((h) => {
                        const needsEtaBeforePick =
                          request &&
                          ["confirmed", "treated"].includes(request.status) &&
                          !isPrescription &&
                          propAvailability === "to_order" &&
                          !propExpectedDate.trim();
                        return (
                        <li key={h.id}>
                          <button
                            type="button"
                            disabled={propBusy || Boolean(needsEtaBeforePick)}
                            onClick={() =>
                              void insertPharmacistProposedLine(h, {
                                lineKind: isPrescription ? "proposed" : undefined,
                                qty: isProductRequestSent
                                  ? 1
                                  : Math.min(
                                      PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
                                      Math.max(1, parseInt(propQty, 10) || 1)
                                    ),
                              })
                            }
                            className="flex w-full touch-manipulation items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-card disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <div
                              className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-violet-200/60 bg-violet-50/50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PharmacistProductPhotoThumb
                                photoUrl={h.photo_url}
                                title={h.name}
                                descriptionHtml={h.full_description}
                                onPhotoPreview={openProductPhotoPreview}
                                iconClassName="text-violet-500/80"
                              />
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-foreground">{h.name}</span>
                              <ProductBrandLabel brand={h.brand} />
                              {formatPharmacyCatalogPrice(pricingConfig, catalogHitToPricingInput(h)) !== "—" ? (
                                <span className="mt-0.5 block text-[11px] font-medium text-teal-800">
                                  PU {formatPharmacyCatalogPrice(pricingConfig, catalogHitToPricingInput(h))}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  ) : propDebounced.length >= 2 ? (
                    <p className="text-[11px] text-muted-foreground">Aucun résultat.</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {respondedFrozenView && isProductRequest ? (
            <section className="mx-auto mt-3 w-full max-w-md">
              <button
                type="button"
                onClick={() => {
                  resetDraftFromRows();
                  setPendingProposalRows([]);
                  setPendingAlternatives([]);
                  setPendingDeletedAlternativeIds([]);
                  setRespondedEditMode(true);
                  setError("");
                  window.setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 0);
                }}
                className={uiActionBtnFull(
                  "min-h-[3rem] rounded-2xl text-sm font-bold tracking-tight shadow-md hover:shadow-lg sm:text-base"
                )}
              >
                <span className="inline-flex items-center justify-center gap-2">
                  <Pencil className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
                  Modifier la réponse
                </span>
              </button>
              <p className="mt-2 text-center text-[10px] leading-snug text-muted-foreground">
                Consultation libre des lignes et alternatives · édition après ce bouton.
              </p>
            </section>
          ) : respondedFrozenView ? (
            <section className="mt-3">
              <button
                type="button"
                onClick={() => {
                  resetDraftFromRows();
                  setPendingProposalRows([]);
                  setPendingAlternatives([]);
                  setPendingDeletedAlternativeIds([]);
                  setRespondedEditMode(true);
                  setError("");
                  window.setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 0);
                }}
                className="inline-flex h-10 min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/40 sm:min-h-10 sm:text-sm"
              >
                <Pencil className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
                Modifier la réponse
              </button>
            </section>
          ) : null}

          {showLineAndPublishEdits ? (
            <section className="mt-3 space-y-2 sm:mt-4">
              {canEditResponse ? (
                <>
                  {publishMissingReceptionDate.blocked ? (
                    <p
                      role="status"
                      className="rounded-lg border border-amber-300/80 bg-amber-50/70 px-2.5 py-2 text-[11px] leading-snug text-amber-950"
                    >
                      {PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR}
                      {publishMissingReceptionDate.names.length > 0 ? (
                        <span className="mt-1 block font-medium text-amber-900">
                          {publishMissingReceptionDate.names.map((n) => `« ${n} »`).join(" · ")}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      busy || Boolean(requestDrift.stale) || publishMissingReceptionDate.blocked
                    }
                    title={
                      publishMissingReceptionDate.blocked
                        ? PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR
                        : requestDrift.stale?.message
                    }
                    onClick={() => {
                      if (requestDrift.stale) {
                        setError(requestDrift.stale.message);
                        return;
                      }
                      if (publishMissingReceptionDate.blocked) {
                        setError(PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR);
                        return;
                      }
                      setError("");
                      setPublishConfirmOpen(true);
                    }}
                    className={clsx(
                      uiActionBtnFull(
                        "min-h-[3.25rem] rounded-2xl text-base font-bold tracking-tight shadow-lg hover:shadow-xl sm:min-h-[3.5rem] sm:text-[1.05rem]"
                      ),
                      isConsultation && "bg-violet-700 text-white hover:bg-violet-800"
                    )}
                  >
                    {isConsultation ? "Publier les produits au patient…" : "Envoyer la réponse au patient…"}
                  </button>
                </>
              ) : null}
            </section>
          ) : !respondedFrozenView ? (
            request.status === "completed" ? (
              <p className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                Dossier clôturé côté comptoir ; les lignes restent lisibles sans modification.
              </p>
            ) : !["submitted", "in_review", "responded", "confirmed", "treated"].includes(request.status) ? (
              <p className="mt-3 rounded-md border border-border bg-muted/30 p-2 text-[11px] text-muted-foreground">
                {`Statut : ${requestStatusFr[request.status] ?? request.status}.`}
              </p>
            ) : null
          ) : null}

          {!hideMainRequestHeader && counterClosureEligible && !canCompleteCounter && items.length > 0 ? (
            <p className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
              {counterClosurePendingTracked > 0
                ? "Marquez au moins un produit « Récupéré » au comptoir pour pouvoir clôturer le dossier."
                : request.status === "confirmed"
                  ? "Déclarez d’abord la demande traitée, puis marquez les retraits au comptoir ligne par ligne."
                  : "La clôture est possible dès qu’au moins une ligne retenue est marquée récupérée."}
            </p>
          ) : null}

          {(request.status === "submitted" ||
            request.status === "in_review" ||
            request.status === "responded" ||
            request.status === "confirmed" ||
            request.status === "treated") &&
          !(canManageResponded && respondedEditMode) ? (
            <div className="mt-6 border-t border-rose-200/50 pt-4">
              <button
                type="button"
                disabled={cancelBusy}
                onClick={() => {
                  setCancelModalNonce((n) => n + 1);
                  setCancelModalOpen(true);
                }}
                className="mx-auto flex min-h-[2.75rem] min-w-[min(100%,14rem)] max-w-md items-center justify-center rounded-lg border border-rose-300/70 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-sm hover:bg-rose-100/90 disabled:opacity-50"
              >
                Annuler la demande
              </button>
              <RequestExitConfirmModalFr
                key={cancelModalNonce}
                open={cancelModalOpen}
                mode="pharmacist_cancel"
                busy={cancelBusy}
                onClose={() => {
                  if (cancelBusy) return;
                  setCancelModalOpen(false);
                }}
                onConfirmPharmacist={async (p) => {
                  await runPharmacistCancelRequest(p.motif);
                }}
              />
            </div>
          ) : null}

          {pharmacistArchiveTerminalFootnote ? (
            <p className="mt-4 border-t border-border/60 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              <span className="block">{pharmacistArchiveTerminalFootnote.label}</span>
              {pharmacistArchiveTerminalFootnote.relative ? (
                <span className="mt-0.5 block text-[10px] text-slate-500/90">
                  ({pharmacistArchiveTerminalFootnote.relative})
                </span>
              ) : null}
            </p>
          ) : null}

          <details
            className="group mt-3 rounded-lg border border-sky-200/70 bg-sky-50/25 p-2 shadow-sm ring-1 ring-sky-100/60"
            onToggle={(e) => {
              const open = (e.currentTarget as HTMLDetailsElement).open;
              setHistoryOpen(open);
              if (open && historyRows.length === 0 && !historyBusy) {
                void loadHistory();
              }
            }}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-1 text-sky-950 [&::-webkit-details-marker]:hidden">
              <span className="text-[11px] font-bold uppercase tracking-wide">Historique du dossier</span>
              <ChevronDown
                className="size-3.5 shrink-0 opacity-80 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="mt-2 border-t border-sky-200/60 pt-2">
              <DossierHistoryListFr
                rows={historyRows}
                viewerRole="pharmacien"
                busy={historyBusy}
                supplyBundles={supplyAmendmentBundles}
                timeline={{
                  requestCreatedAt: request.created_at,
                  requestSubmittedAt: request.submitted_at,
                  requestRespondedAt: request.responded_at,
                  requestConfirmedAt: request.confirmed_at ?? null,
                  requestStatus: request.status,
                  plannedVisitDate: request.patient_planned_visit_date,
                  plannedVisitTime: request.patient_planned_visit_time,
                }}
              />
            </div>
          </details>
        </>
      ) : null}
      {lineConvoEffectiveRowId
        ? (() => {
            const entry = lineEntriesForList.find((e) => e.row.id === lineConvoEffectiveRowId);
            if (!entry) return null;
            const row = entry.row;
            const fd = draft[row.id];
            if (!fd) return null;
            const co = row.counter_outcome ?? "unset";
            const lineLockedTrace = co === "cancelled_at_counter";
            const canEditThisRow = showLineAndPublishEdits && !lineLockedTrace;
            const patientLineCcModal = row.client_comment?.trim() ?? "";
            return (
              <PharmacistLineConversationModal
                key={row.id}
                lineId={row.id}
                open
                onOpenChange={(o) => {
                  if (!o) setLineConvoRowId(null);
                }}
                patientText={patientLineCcModal}
                pharmacistDraft={fd.pharmacist_comment}
                onPharmacistDraftChange={(text) => setField(row.id, "pharmacist_comment", text)}
                allowEdit={canEditThisRow && canEditLineProductNotes}
                showPersistButton={false}
                persistBusy={false}
              />
            );
          })()
        : null}
      {publishConfirmOpen ? (
        <AppModalOverlay
          open
          aria-labelledby="publish-confirm-title"
          className="overflow-y-auto p-3 sm:items-center"
          onBackdropClick={() => {
            if (!busy) setPublishConfirmOpen(false);
          }}
        >
          <div
            className="relative z-10 flex max-h-[min(92vh,36rem)] w-full max-w-lg flex-col rounded-2xl border border-border bg-card p-4 shadow-2xl ring-1 ring-primary/15 sm:max-w-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="publish-confirm-title" className="shrink-0 text-center text-sm font-bold text-foreground">
              Confirmer l&apos;envoi au patient
            </h2>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
              <div className="space-y-3 text-[11px]">
                {publishConfirmGroups.ready.length > 0 ? (
                  <section className="rounded-xl border border-emerald-300/75 bg-emerald-100/45 p-2.5">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                      Disponibles · {publishConfirmGroups.ready.length}
                    </h3>
                    <ul className="space-y-2">
                      {publishConfirmGroups.ready.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
                          pricingConfig={pricingConfig}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {publishConfirmGroups.order.length > 0 ? (
                  <section className="rounded-xl border border-amber-300/75 bg-amber-100/45 p-2.5">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                      À commander · {publishConfirmGroups.order.length}
                    </h3>
                    <ul className="space-y-2">
                      {publishConfirmGroups.order.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
                          pricingConfig={pricingConfig}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {publishConfirmGroups.blocked.length > 0 ? (
                  <section className="rounded-xl border border-slate-300/70 bg-slate-200/40 p-2.5">
                    <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-800">
                      Non disponibles · {publishConfirmGroups.blocked.length}
                    </h3>
                    <ul className="space-y-2">
                      {publishConfirmGroups.blocked.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
                          pricingConfig={pricingConfig}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
            <div className="mt-4 flex shrink-0 flex-col-reverse gap-2 border-t border-border/50 pt-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => setPublishConfirmOpen(false)}
                className={uiActionBtnModalOutline("h-10 text-xs font-semibold disabled:opacity-50")}
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy || publishMissingReceptionDate.blocked}
                title={
                  publishMissingReceptionDate.blocked
                    ? PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR
                    : undefined
                }
                onClick={() => {
                  if (publishMissingReceptionDate.blocked) {
                    setError(PHARMACIST_PUBLISH_MISSING_RECEPTION_DATE_NOTE_FR);
                    return;
                  }
                  setPublishConfirmOpen(false);
                  void publishResponse();
                }}
                className={uiActionBtnModalPrimary("h-10 text-xs font-bold disabled:opacity-50")}
              >
                {busy ? "Publication…" : "Confirmer et envoyer"}
              </button>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}
      {canManageResponded && respondedEditMode && !stickyFooterObscured ? (
        <PlatformStickyFooter tone="amber" width="3xl" zIndex={10050}>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                resetDraftFromRows();
                setRespondedEditMode(false);
                resetRespondedLineAltUi();
                setPendingProposalRows([]);
                setPendingAlternatives([]);
                setPendingDeletedAlternativeIds([]);
                setRemovedPersistedRespondedEditIds([]);
                setError("");
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-400/90 bg-white px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50/90 disabled:opacity-50 sm:order-1 sm:w-auto sm:min-w-[9rem]"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const b = respondedEditBaselineRef.current;
                if (!b) {
                  setError("Réouvrez « Modifier la réponse » puis réessayez.");
                  return;
                }
                setError("");
                const diffs = diffRespondedSnapshots(
                  b,
                  displayRows,
                  draft,
                  altQtyDrafts,
                  pendingProposalRows,
                  pendingAlternatives,
                  pendingDeletedAlternativeIds,
                  removedPersistedRespondedEditIds
                );
                setRespondedSaveDiffLines(diffs);
                setRespondedSaveConfirmOpen(true);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-600 bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-amber-700 disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
            >
              Enregistrer
            </button>
          </div>
        </PlatformStickyFooter>
      ) : null}
      {respondedSaveConfirmOpen ? (
        <AppModalOverlay
          open
          aria-labelledby="responded-save-confirm-title"
          className="overflow-y-auto p-3 sm:items-center"
          onBackdropClick={() => {
            if (!busy) {
              setRespondedSaveConfirmOpen(false);
              setRespondedSaveDiffLines([]);
            }
          }}
        >
          <div
            className="relative z-10 flex max-h-[min(88vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-200/90 bg-card p-4 shadow-2xl ring-1 ring-amber-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="responded-save-confirm-title" className="text-center text-sm font-bold text-amber-950">
              Confirmer les modifications
            </h2>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
              Vérifiez le résumé ci-dessous avant d&apos;appliquer les changements visibles par le patient.
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-amber-200/60 bg-amber-50/40 px-2.5 py-2">
              {respondedSaveDiffLines.length === 0 ? (
                <p className="text-center text-[11px] font-medium text-amber-900/90">Aucune modification détectée.</p>
              ) : (
                <ul className="space-y-1.5 text-[11px] leading-snug text-amber-950">
                  {respondedSaveDiffLines.map((line, i) => (
                    <li key={`${i}-${line.slice(0, 24)}`} className="flex gap-2 rounded-md border border-amber-200/50 bg-white/90 px-2 py-1.5">
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/50 pt-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setRespondedSaveConfirmOpen(false);
                  setRespondedSaveDiffLines([]);
                }}
                className={uiActionBtnModalOutline("h-10 text-xs font-semibold disabled:opacity-50")}
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy || respondedSaveDiffLines.length === 0}
                onClick={() => void saveRespondedAdjustments()}
                className={uiActionBtnModalPrimary("h-10 text-xs font-bold disabled:opacity-50")}
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}

      {supplySaveConfirmOpen ? (
        <AppModalOverlay
          open
          aria-labelledby="supply-save-confirm-title"
          className="overflow-y-auto p-3 sm:items-center"
          onBackdropClick={() => {
            if (!busy) {
              setSupplySaveConfirmOpen(false);
              setSupplySaveConfirmLines([]);
            }
          }}
        >
          <div
            className="relative z-10 flex max-h-[min(92vh,34rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/90 bg-card p-4 shadow-2xl ring-1 ring-primary/15 sm:max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="supply-save-confirm-title" className="text-center text-sm font-bold text-foreground">
              Confirmer l’enregistrement
            </h2>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
              Vérifiez le résumé avant de valider. Le canal patient est obligatoire lorsque la modification doit être
              notifiée au patient (ajustement officine, retrait, ajout).
            </p>
            <div className="mt-3 space-y-2 rounded-lg border border-sky-300/70 bg-sky-100/40 p-2.5">
              <label className="block text-[10px] font-semibold text-foreground">
                Canal d&apos;accord patient
                <div className="mt-1">
                  <PolishedOptionPicker
                    options={SUPPLY_AMEND_CHANNEL_OPTIONS.map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                    value={supplySaveGlobalChannel}
                    placeholder="Choisir…"
                    onPick={setSupplySaveGlobalChannel}
                    ariaLabel="Canal d'accord patient"
                  />
                </div>
              </label>
              <label className="block text-[10px] font-semibold text-foreground">
                Description (optionnelle)
                <textarea
                  rows={2}
                  maxLength={500}
                  value={supplySaveGlobalMotive}
                  onChange={(e) => setSupplySaveGlobalMotive(e.target.value.slice(0, 500))}
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-[11px] shadow-sm"
                  placeholder="Précision commune à toutes les modifications…"
                />
              </label>
            </div>
            <div className="mt-3 min-h-0 max-h-[10rem] flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-border/70 bg-muted/25 px-2.5 py-2">
              {supplySaveConfirmLines.length === 0 ? (
                <p className="text-center text-[11px] font-medium text-muted-foreground">Aucun détail à afficher.</p>
              ) : (
                <ul className="space-y-1.5 text-[11px] leading-snug text-foreground">
                  {supplySaveConfirmLines.map((line, i) => (
                    <li
                      key={`${i}-${line.slice(0, 24)}`}
                      className="flex gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5"
                    >
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/50 pt-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSupplySaveConfirmOpen(false);
                  setSupplySaveConfirmLines([]);
                  setSupplySaveGlobalChannel("");
                  setSupplySaveGlobalMotive("");
                }}
                className={uiActionBtnModalOutline("h-10 text-xs font-semibold disabled:opacity-50")}
              >
                Retour
              </button>
              <button
                type="button"
                disabled={
                  busy ||
                  (supplySaveConfirmNeedsChannel && supplySaveGlobalChannel.trim().length < 2)
                }
                onClick={() => void executeConfirmedSupplySave()}
                className={uiActionBtnModalPrimary("h-10 text-xs font-bold disabled:opacity-50")}
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}

      {showMainSupplyFooter && !stickyFooterObscured ? (
        <PlatformStickyFooterStack
          tone={hideMainRequestHeader && isProductRequest ? "slate" : "sky"}
        >
          {showSupplyStatsFooter ? (
            <PlatformStickyFooterStackRow compact bordered={false}>
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] text-foreground">
                <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                  {supplyFooterTotals.count} produit{supplyFooterTotals.count > 1 ? "s" : ""}
                </span>
                <span className="min-w-0 text-end font-bold tabular-nums text-foreground">
                  Total :{" "}
                  {supplyFooterTotals.count === 0
                    ? "—"
                    : supplyFooterTotals.missingPrice && supplyFooterTotals.total === 0
                      ? "prix partiellement renseigné"
                      : `${supplyFooterTotals.total.toLocaleString("fr-FR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} MAD`}
                  {supplyFooterTotals.missingPrice && supplyFooterTotals.total > 0 ? (
                    <span className="ml-1 font-normal text-muted-foreground">(estimation partielle)</span>
                  ) : null}
                </span>
              </div>
            </PlatformStickyFooterStackRow>
          ) : null}
          {showDeclareTreatedSticky ? (
            <PlatformStickyFooterStackRow compact bordered={showSupplyStatsFooter}>
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold leading-snug text-foreground">
                  Préparation prête ?
                  <InfoHint label="À propos de « Déclarer la demande traitée »" placement="up" align="start">
                    Quand la préparation est prête, déclarez la demande traitée. Le patient pourra suivre le passage au
                    comptoir ; vous marquerez ensuite les réceptions en officine et les retraits ligne par ligne.
                  </InfoHint>
                </span>
                <button
                  type="button"
                  disabled={declareTreatedBusy || Boolean(requestDrift.stale)}
                  title={requestDrift.stale?.message}
                  onClick={() => setDeclareTreatedModalOpen(true)}
                  className={uiActionBtnModalPrimary(
                    "h-10 min-w-0 flex-1 px-4 text-sm font-bold whitespace-nowrap disabled:opacity-50"
                  )}
                >
                  Déclarer traitée
                </button>
              </div>
            </PlatformStickyFooterStackRow>
          ) : null}
          {showCloseCounterSticky ? (
            <PlatformStickyFooterStackRow
              bordered={Boolean(showSupplyStatsFooter || showDeclareTreatedSticky)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-center text-[11px] leading-snug text-muted-foreground sm:flex-1 sm:text-left">
                  Au moins un produit est récupéré — vous pouvez clôturer (les autres seront retirés).
                </p>
                <button
                  type="button"
                  disabled={completeBusy}
                  onClick={() => setCloseConfirmOpen(true)}
                  className={uiActionBtnModalPrimary(
                    "h-10 w-full shrink-0 px-4 text-sm font-bold disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
                  )}
                >
                  {completeBusy ? "Clôture…" : "Clôturer le dossier"}
                </button>
              </div>
            </PlatformStickyFooterStackRow>
          ) : null}
          {showSupplyDirtyBar ? (
            <PlatformStickyFooterStackRow bordered={false}>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cancelConfirmedSupplyEdits()}
                  className={uiActionBtnModalOutline(
                    "h-10 w-full text-sm font-semibold disabled:opacity-50 sm:order-1 sm:w-auto sm:min-w-[9rem]"
                  )}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startSaveConfirmedAdjustments()}
                  className={uiActionBtnModalPrimary(
                    "h-10 w-full text-sm font-bold disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
                  )}
                >
                  {busy ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            </PlatformStickyFooterStackRow>
          ) : null}
        </PlatformStickyFooterStack>
      ) : null}

      <PharmacistDeclareTreatedConfirmModal
        open={declareTreatedModalOpen}
        busy={declareTreatedBusy}
        summary={declareTreatedSummary}
        requestStatus={request?.status}
        onClose={() => {
          if (declareTreatedBusy) return;
          setDeclareTreatedModalOpen(false);
        }}
        onConfirm={() => void runDeclareRequestTreated()}
      />
      {closeRequestSummary ? (
        <PharmacistCloseRequestConfirmModal
          open={closeConfirmOpen}
          busy={completeBusy}
          summary={closeRequestSummary}
          onClose={() => {
            if (completeBusy) return;
            setCloseConfirmOpen(false);
          }}
          onConfirm={() => void runCompleteAfterCounter()}
        />
      ) : null}
      {isPrescription && showLineAndPublishEdits ? (
        <PharmacistOrdonnanceQuickAddModal
          open={ordonnanceQuickAddOpen}
          onClose={() => {
            setOrdonnanceQuickAddOpen(false);
            resetOrdonnanceQuickAddForm();
          }}
          lineCount={ordonnanceLineCount}
          busy={propBusy}
          query={propQuery}
          onQueryChange={setPropQuery}
          hits={propVisibleHits}
          selectedProduct={ordonnanceQuickAddPick}
          onSelectProduct={(h) => {
            setOrdonnanceQuickAddPick(h as ProductCatalogHit);
            setPropQuery("");
            setPropHits([]);
            const reqN = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const avail = ordonnanceInsertAvailableQty(ordonnanceQuickAvailability, reqN, undefined);
            setOrdonnanceQuickAvailableQty(String(avail));
          }}
          onClearProduct={() => {
            setOrdonnanceQuickAddPick(null);
            setOrdonnanceQuickAlternatives([]);
            setOrdonnanceAltQuery("");
          }}
          alternatives={ordonnanceQuickAlternatives}
          altQuery={ordonnanceAltQuery}
          onAltQueryChange={setOrdonnanceAltQuery}
          altHits={ordonnanceAltVisibleHits}
          onAddAlternative={(h) => {
            if (ordonnanceQuickAlternatives.length >= 3) return;
            if (h.id === ordonnanceQuickAddPick?.id) return;
            if (pharmacistRequestCatalogProductIdBlocked(h.id, displayRows, draft, catalogBlockRequestStatus)) {
              setError(pharmacistRequestCatalogProductBlockMessageFr(request?.status ?? null));
              return;
            }
            const reqN = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            setOrdonnanceQuickAlternatives((prev) => [
              ...prev,
              {
                id: h.id,
                name: h.name,
                product_type: h.product_type,
                price_pph: h.price_pph ?? null,
                price_ppv: h.price_ppv ?? null,
                photo_url: h.photo_url ?? null,
                full_description: h.full_description ?? null,
                available_qty: Math.max(1, reqN),
              },
            ]);
            setOrdonnanceAltQuery("");
            setOrdonnanceAltHits([]);
          }}
          onAlternativeQtyChange={(productId, qty) => {
            setOrdonnanceQuickAlternatives((prev) =>
              prev.map((a) => (a.id === productId ? { ...a, available_qty: qty } : a))
            );
          }}
          onRemoveAlternative={(productId) => {
            setOrdonnanceQuickAlternatives((prev) => prev.filter((a) => a.id !== productId));
          }}
          requestedQty={ordonnanceQuickRequestedQty}
          onRequestedQtyChange={(raw) => {
            const prev = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const applied = applyOrdonnanceRequestedQtyChange(
              raw,
              prev,
              parseInt(ordonnanceQuickAvailableQty, 10) || prev,
              ordonnanceQuickAvailability
            );
            if (!applied) {
              if (raw.replace(/[^\d]/g, "") === "") setOrdonnanceQuickRequestedQty("");
              return;
            }
            setOrdonnanceQuickRequestedQty(String(applied.requestedQty));
            setOrdonnanceQuickAvailableQty(String(applied.availableQty));
            const inferred = inferAvailabilityStatusFromQty({
              status: applied.availability,
              availableQty: applied.availableQty,
              requestedQty: applied.requestedQty,
              isProposedLine: false,
            });
            setOrdonnanceQuickAvailability(inferred);
          }}
          availableQty={ordonnanceQuickAvailableQty}
          onAvailableQtyChange={(raw) => {
            const req = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const applied = applyOrdonnanceAvailableQtyChange(raw, req, ordonnanceQuickAvailability);
            if (!applied) {
              if (raw.replace(/[^\d]/g, "") === "") setOrdonnanceQuickAvailableQty("");
              return;
            }
            setOrdonnanceQuickAvailableQty(String(applied.availableQty));
            setOrdonnanceQuickAvailability(applied.availability);
          }}
          onRequestedQtyNudge={(delta) => {
            const prev = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const applied = nudgeOrdonnanceRequestedQty(
              delta,
              prev,
              parseInt(ordonnanceQuickAvailableQty, 10) || prev,
              ordonnanceQuickAvailability
            );
            setOrdonnanceQuickRequestedQty(String(applied.requestedQty));
            setOrdonnanceQuickAvailableQty(String(applied.availableQty));
            const inferred = inferAvailabilityStatusFromQty({
              status: applied.availability,
              availableQty: applied.availableQty,
              requestedQty: applied.requestedQty,
              isProposedLine: false,
            });
            setOrdonnanceQuickAvailability(inferred);
          }}
          onAvailableQtyNudge={(delta) => {
            const req = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const applied = nudgeOrdonnanceAvailableQty(
              delta,
              req,
              parseInt(ordonnanceQuickAvailableQty, 10) || 0,
              ordonnanceQuickAvailability
            );
            setOrdonnanceQuickAvailableQty(String(applied.availableQty));
            setOrdonnanceQuickAvailability(applied.availability);
          }}
          note={ordonnanceQuickNote}
          onNoteChange={setOrdonnanceQuickNote}
          availability={ordonnanceQuickAvailability}
          onAvailabilityChange={(v) => {
            const req = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const avail = parseInt(ordonnanceQuickAvailableQty, 10) || 0;
            const patch = applyOrdonnanceAvailabilityChange(v, req, avail);
            const inferred = inferAvailabilityStatusFromQty({
              status: patch.availability,
              availableQty: patch.availableQty,
              requestedQty: req,
              isProposedLine: false,
            });
            setOrdonnanceQuickAvailability(inferred);
            setOrdonnanceQuickAvailableQty(String(patch.availableQty));
          }}
          expectedDate={ordonnanceQuickExpectedDate}
          onExpectedDateChange={setOrdonnanceQuickExpectedDate}
          receptionDateMin={receptionDateMinYmd}
          catalogUnitPriceLabel={(h) => {
            const dh = formatPharmacyCatalogPrice(
              pricingConfig,
              catalogHitToPricingInput(h as ProductCatalogHit)
            );
            return dh !== "—" ? dh : null;
          }}
          onConfirmAdd={async () => {
            if (!ordonnanceQuickAddPick) {
              setError("Sélectionnez un produit dans le catalogue.");
              return;
            }
            const req = clampOrdonnanceRequestedQty(parseInt(ordonnanceQuickRequestedQty, 10) || 1);
            const availParsed =
              ordonnanceQuickAvailableQty.trim() === ""
                ? undefined
                : parseInt(ordonnanceQuickAvailableQty, 10);
            const avail = ordonnanceInsertAvailableQty(
              ordonnanceQuickAvailability,
              req,
              availParsed
            );
            setPropBusy(true);
            await insertPharmacistProposedLine(ordonnanceQuickAddPick, {
              requestedQty: req,
              availableQty: avail,
              availability: ordonnanceQuickAvailability,
              pharmacistComment: ordonnanceQuickNote,
              expectedAvailabilityDate: ordonnanceQuickExpectedDate,
              fromQuickAdd: true,
              lineKind: "ordonnance",
              alternatives: ordonnanceQuickAlternatives,
            });
            setPropBusy(false);
          }}
        />
      ) : null}
      <LineHistoryModalFr
        open={pharmaHistoryRowId != null}
        title={
          pharmaHistoryRowId
            ? validatedProductLabel(items.find((i) => i.id === pharmaHistoryRowId) as PatientLineLike)
            : ""
        }
        blocks={pharmaHistoryBlocks}
        onClose={() => setPharmaHistoryRowId(null)}
      />
      <PatientProductPhotoPreviewModal
        open={productPhotoPreview != null}
        imageUrl={productPhotoPreview?.url ?? null}
        title={productPhotoPreview?.title ?? ""}
        descriptionHtml={productPhotoPreview?.descriptionHtml}
        onClose={() => setProductPhotoPreview(null)}
      />
      {usesLineWorkflow &&
      sessionUserId &&
      (!isConsultation || !["submitted", "in_review", "responded"].includes(request.status)) ? (
        <>
          <RequestConversationFabDock
            hasUnread={conversationUnread}
            onOpen={() => setConversationOpen(true)}
            tone="pharmacien"
            hidden={Boolean(prescriptionScanLightbox)}
          />
          <RequestConversationPanel
            requestId={id}
            viewerRole="pharmacien"
            currentUserId={sessionUserId}
            open={conversationOpen}
            onClose={() => setConversationOpen(false)}
            onMarkedRead={handleConversationMarkedRead}
          />
        </>
      ) : null}
    </PageShell>
  );
}
