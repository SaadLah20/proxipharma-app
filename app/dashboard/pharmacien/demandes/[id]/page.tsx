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
  Trash2,
  User,
} from "lucide-react";
import {
  lineConversationStripButtonClass,
  lineConversationStripLabel,
  lineConversationVisual,
  PharmacistLineConversationModal,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { RequestExitConfirmModalFr } from "@/components/requests/request-exit-confirm-modal-fr";
import { availabilityStatusUi } from "@/lib/pharmacist-availability-ui";
import { supabase } from "@/lib/supabase";
import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import {
  PHARMACIST_AVAILABILITY_OPTIONS,
  PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS,
  PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS,
  inferAvailabilityStatusFromQty,
} from "@/lib/pharmacist-availability";
import { SUPPLY_AMEND_CHANNEL_OPTIONS, supplyAmendChannelLabel } from "@/lib/supply-amendment-channels";
import {
  availabilityStatusFr,
  counterOutcomeFr,
  formatShortId,
  historyActorLabel,
  pharmacistRequestIsClosedSuccess,
  pharmacistRequestIsHardStopped,
  requestHistoryPharmacistHeadline,
  requestStatusFr,
} from "@/lib/request-display";
import {
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
import { sharedShowPlannedVisitBlock } from "@/lib/request-kinds/shared-capabilities";
import { RequestDetailBackLink } from "@/components/requests/shared/request-detail-back-link";
import { RequestKindHeader } from "@/components/requests/shared/request-kind-header";
import { ConsultationBriefPanel } from "@/components/requests/consultation/consultation-brief-panel";
import { ConsultationBriefCompact } from "@/components/requests/consultation/consultation-brief-compact";
import { ConsultationDetailTabBar } from "@/components/requests/consultation/consultation-detail-tab-bar";
import { ConsultationDetailStickyChrome } from "@/components/requests/consultation/consultation-detail-sticky-chrome";
import {
  getConsultationDefaultTab,
  type ConsultationDetailTab,
} from "@/lib/consultation-detail-tabs";
import { RequestConversationInline } from "@/components/requests/request-conversation-inline";
import { PrescriptionImageViewer } from "@/components/requests/prescription/prescription-image-viewer";
import { PharmacistOrdonnanceQuickAddModal } from "@/components/requests/prescription/pharmacist-ordonnance-quick-add-modal";
import {
  isPrescriptionOrdonnancePharmacistLine,
  isPrescriptionOrdonnancePrincipalLine,
  isPrescriptionAdditionalProposedLine,
  isProductRequestAjoutOfficineLine,
  PRESCRIPTION_ORDONNANCE_REASON,
  PRESCRIPTION_ADDITIONAL_PROPOSED_REASON,
} from "@/lib/prescription-pharmacist-lines";
import { inferArchiveSnapshotStatus } from "@/lib/request-archive-snapshot-status";
import { prescriptionLineRequiresPatientConsent } from "@/lib/prescription-patient-labels";
import {
  applyOrdonnanceAvailabilityChange,
  applyOrdonnanceAvailableQtyChange,
  applyOrdonnanceRequestedQtyChange,
  clampOrdonnanceRequestedQty,
  nudgeOrdonnanceAvailableQty,
  nudgeOrdonnanceRequestedQty,
  ordonnanceDraftRequestedQty,
  ordonnanceInsertAvailableQty,
} from "@/lib/prescription-ordonnance-line-qty";
import type { ConsultationImagePaths } from "@/lib/consultation-media";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";
import { one } from "@/lib/embed";
import { formatPphMad, pphLabel } from "@/lib/product-price";
import { mapRequestItemRowPhotos, mapRequestItemsPhotos, resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { PageShell } from "@/components/ui/compact-shell";
import { InfoHint } from "@/components/ui/info-hint";
import {
  PharmacistCloseRequestConfirmModal,
  type PharmacistCloseRequestSummary,
} from "@/components/pharmacist/pharmacist-close-request-confirm-modal";
import { flattenPharmacistSupplyListEntriesStable } from "@/lib/pharmacist-supply-list-order";
import {
  bucketPatientValidatedLinesThreeWays,
  validatedBranchUnitPriceMad,
  validatedProductLabel,
  validatedQtyForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import { buildPatientLineTimelineFr, postConfirmSupplyAmendmentBadgeLabelsFr } from "@/lib/build-patient-line-timeline-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { RequestConversationFabDock, RequestConversationPanel } from "@/components/requests/request-conversation-panel";
import { PharmacistSupplyCompactLine } from "@/components/pharmacist/pharmacist-supply-compact-line";
import { type SupplyAmendmentEntryJson } from "@/lib/supply-amendment-channels";
import { assertReceptionDateNotBeforeToday, todayLocalIsoDate } from "@/lib/planned-visit";
import {
  dispatchRequestDetailRefresh,
  REQUEST_DETAIL_REFRESH_EVENT,
  type RequestDetailRefreshDetail,
} from "@/lib/request-detail-refresh-bus";
import {
  PharmacistSupplyAmendmentConfirmModal,
  type SupplyConfirmBlock,
} from "@/components/pharmacist/pharmacist-supply-amendment-confirm-modal";

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

type ProdEmbedDb = { name: string; price_pph?: number | null; photo_url?: string | null };

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
  "id,product_id,requested_qty,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,counter_outcome,counter_cancel_reason,counter_cancel_detail,is_selected_by_patient,selected_qty,patient_chosen_alternative_id,post_confirm_fulfillment,withdrawn_after_confirm,line_source,pharmacist_proposal_reason,client_comment,updated_at,products(name,price_pph,photo_url),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url))";

function rowsWithEffectiveWithdrawnForSupply(rows: ItemRow[], d: Draft): ItemRow[] {
  return rows.map((row) => {
    const f = d[row.id];
    const effective = Boolean(row.withdrawn_after_confirm) || Boolean(f?.withdrawn_after_confirm);
    if (effective === Boolean(row.withdrawn_after_confirm)) return row;
    return { ...row, withdrawn_after_confirm: effective };
  });
}

type ProductCatalogHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
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

function buildPharmacistSupplySections(rows: ItemRow[]): { title: string; rows: ItemRow[] }[] {
  const b = bucketPatientValidatedLinesThreeWays(rows);
  const sections: { title: string; rows: ItemRow[] }[] = [
    { title: `À réserver (validé · ${b.dispoOfficine.length})`, rows: b.dispoOfficine },
    { title: `À commander (validé · ${b.aCommander.length})`, rows: b.aCommander },
    { title: `Hors bloc principal (${b.horsPerimetre.length})`, rows: b.horsPerimetre },
    { title: `Écart après validation (${b.retireesApresValidation.length})`, rows: b.retireesApresValidation },
  ];
  return sections.filter((s) => s.rows.length > 0);
}

function flattenPharmacistSupplyListEntries(rows: ItemRow[]): { header: string | null; row: ItemRow }[] {
  const secs = buildPharmacistSupplySections(rows);
  const out: { header: string | null; row: ItemRow }[] = [];
  for (const s of secs) {
    s.rows.forEach((row, i) => {
      out.push({ header: i === 0 ? s.title : null, row });
    });
  }
  return out;
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

  if (chosenAlt) {
    const altSt = chosenAlt.availability_status ?? "";
    if (altSt === "partially_available" || altSt === "available" || altSt === "to_order") {
      const altNorm = altSt === "partially_available" ? "available" : altSt;
      const mainSt = row.availability_status ?? "";
      /** Brouillon encore sur la ligne principale alors que le patient a validé l’alternative. */
      const postConfirmSupply =
        requestStatus != null &&
        ["confirmed", "treated"].includes(requestStatus) &&
        Boolean(row.is_selected_by_patient);
      const staleMainDraft =
        postConfirmSupply ||
        status === mainSt ||
        Boolean(mainSt && ["unavailable", "market_shortage"].includes(String(mainSt)));
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

function effectiveEtaSupplyDraft(row: ItemRow, f: ItemDraft, requestType?: string): string | null {
  if (effectiveAvailSupplyDraft(row, f, requestType) === "to_order") {
    const d = f.expected_availability_date?.trim();
    return d && d.length > 0 ? d : null;
  }
  const chosen = row.patient_chosen_alternative_id ?? null;
  if (chosen) {
    const alts = normalizeAlts(row.request_item_alternatives);
    const a = alts.find((x) => x.id === chosen);
    return a?.expected_availability_date?.trim() || row.expected_availability_date?.trim() || null;
  }
  return row.expected_availability_date?.trim() || null;
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
    throw new Error("Pour une proposition officine, la quantité en stock doit être au moins 1.");
  }
  const requestedQty = isOrdonnancePharma
    ? ordonnanceDraftRequestedQty(row, f)
    : inferRequestedQtyForAvailability(row);
  if (isOrdonnancePharma && availQty > requestedQty) {
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
    expected_availability_date: f.expected_availability_date.trim() !== "" ? f.expected_availability_date : null,
  };
}

/** Plafond saisie patient / ligne « réponse » classique (hors stock proposition officine, voir `PHARMACIST_PROPOSED_STOCK_CEILING`). */
function clampRequestItemQty(n: number): number {
  return Math.min(10, Math.max(1, Math.floor(Number.isFinite(n) ? n : 1)));
}

/** Quantité alternative en réponse : même plafond que le dossier patient (1–10). */
function clampAlternativeAvailableQty(n: number): number {
  return clampRequestItemQty(n);
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
  amendmentBundles: { amendments: unknown }[] = []
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
      : pphLabel(one(r.products)?.price_pph) ?? "—";
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
}: {
  meta: PublishConfirmRowMeta;
  altQtyDrafts: Record<string, string>;
  proposedBadgeLabel: string;
  ordonnanceBadgeLabel: string;
}) {
  const { r, fd, availUi, proposed, prodName, priceMad, note, eta, alts, ordonnancePrincipal, prescribedQty } = meta;
  const AvailIcon = availUi.Icon;
  const lineBadge = publishConfirmLineBadge(meta, proposedBadgeLabel, ordonnanceBadgeLabel);
  const ordonnanceTone = proposed && lineBadge.tone === "ordonnance";
  const availableQtyNum = Number(fd.available_qty || "0");
  return (
    <li
      key={r.id}
      className={clsx(
        "rounded-xl border-l-[3px] px-2.5 py-2 shadow-sm",
        ordonnanceTone
          ? "border border-amber-300/80 border-l-amber-500 bg-amber-50/40"
          : proposed
            ? "border border-violet-300/80 border-l-violet-500 bg-violet-50/40"
            : clsx("border border-border/80 bg-muted/20", availUi.accentClass)
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-foreground">{prodName}</p>
          {proposed ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={clsx(
                  "shrink-0 rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white",
                  ordonnanceTone ? "bg-amber-700" : "bg-violet-600"
                )}
              >
                {lineBadge.label}
              </span>
              {r.pharmacist_proposal_reason?.trim() ? (
                <p
                  className={clsx(
                    "min-w-0 flex-1 text-[10px] leading-snug",
                    ordonnanceTone ? "text-amber-900/90" : "text-violet-900/90"
                  )}
                >
                  <span className={clsx("font-semibold", ordonnanceTone ? "text-amber-950" : "text-violet-950")}>
                    Motif ·{" "}
                  </span>
                  <span className="italic">{r.pharmacist_proposal_reason.trim()}</span>
                </p>
              ) : (
                <span
                  className={clsx(
                    "text-[10px] italic",
                    ordonnanceTone ? "text-amber-800/85" : "text-violet-800/85"
                  )}
                >
                  Aucun motif renseigné.
                </span>
              )}
            </div>
          ) : (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Ligne demandée · qté patient <strong className="text-foreground">{r.requested_qty}</strong>
            </p>
          )}
        </div>
        <span
          className={clsx(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1",
            availUi.badgeClass
          )}
          title={availUi.label}
        >
          <AvailIcon className="size-3 shrink-0" aria-hidden />
          <span className="max-w-[9rem] truncate">{availUi.label}</span>
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] tabular-nums text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-bold text-foreground/80">
            {ordonnancePrincipal ? "Prescrit" : "Qté / stock"}
          </dt>
          <dd className="font-semibold text-foreground">
            {ordonnancePrincipal ? (prescribedQty ?? "—") : fd.available_qty || "—"}
          </dd>
        </div>
        {ordonnancePrincipal ? (
          <div>
            <dt className="font-bold text-foreground/80">Dispo</dt>
            <dd className="font-semibold text-foreground">
              {Number.isFinite(availableQtyNum) ? availableQtyNum : "—"}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-bold text-foreground/80">Prix</dt>
          <dd className="font-semibold text-foreground">{priceMad}</dd>
        </div>
        {eta ? (
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-bold text-teal-900/90">Réception prévue</dt>
            <dd className="font-semibold text-teal-950">{eta}</dd>
          </div>
        ) : null}
      </dl>
      {note ? (
        <p className="mt-2 rounded-md border border-emerald-200/70 bg-emerald-50/60 px-2 py-1 text-[10px] leading-snug text-emerald-950">
          <span className="font-bold">Note officine · </span>
          {note}
        </p>
      ) : null}
      {alts.length > 0 ? (
        <div className="mt-2 border-t border-teal-200/50 pt-2">
          <p className="text-[9px] font-bold uppercase tracking-wide text-teal-900">Alternatives ({alts.length})</p>
          <ul className="mt-1 space-y-1">
            {alts.map((alt) => {
              const an = one(alt.products)?.name ?? "Alternative";
              const aq = isLocalAltId(alt.id)
                ? clampAlternativeAvailableQty(Number(alt.available_qty ?? 1))
                : clampAlternativeAvailableQty(Number(altQtyDrafts[alt.id] ?? alt.available_qty ?? r.requested_qty));
              const ast = alt.availability_status ?? "—";
              const alab = availabilityStatusFr[ast] ?? ast;
              const aeta =
                ast === "to_order" && alt.expected_availability_date?.trim()
                  ? formatDateShortFr(alt.expected_availability_date.trim())
                  : null;
              const ap =
                alt.unit_price != null && !Number.isNaN(Number(alt.unit_price))
                  ? `${Number(alt.unit_price).toFixed(2)} MAD`
                  : pphLabel(one(alt.products)?.price_pph) ?? "—";
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
    </li>
  );
}

function isPharmacistProposedRow(row: ItemRow): boolean {
  return row.line_source === "pharmacist_proposed" || isLocalProposedItemId(row.id);
}

/** Après accord « Modifier », défaut **Disponible** plein (pas « partiellement » : qté ≥ demandée si statut `available`). */
function draftPatchPostConfirmSupplyUnlock(
  row: ItemRow,
  d: ItemDraft,
  requestStatus: string | null
): Partial<ItemDraft> | null {
  if (isPharmacistProposedRow(row)) return null;
  if (!requestStatus || !["confirmed", "treated"].includes(requestStatus) || !row.is_selected_by_patient) return null;
  if (d.availability_status === "to_order") return null;

  const qRaw = Number(d.available_qty || "0");
  const q = Number.isFinite(qRaw) ? Math.floor(qRaw) : 0;
  const refQty = inferRequestedQtyForAvailability(row);
  const rq = Math.max(1, Math.floor(refQty) || 1);
  const inferred = inferAvailabilityStatusFromQty({
    status: d.availability_status,
    availableQty: q,
    requestedQty: refQty,
    isProposedLine: false,
  });

  if (d.availability_status === "available" && inferred === "available") {
    return null;
  }

  const nextQty = Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, Math.max(q, rq));
  return {
    availability_status: "available",
    available_qty: String(nextQty),
  };
}

function effectiveWithdrawnAfterConfirm(row: ItemRow, draft: Draft): boolean {
  const fd = draft[row.id];
  return Boolean(row.withdrawn_after_confirm) || Boolean(fd?.withdrawn_after_confirm);
}

/**
 * Blocage « ajout officine » : même `product_id` que la réponse.
 * Hors `confirmed` / `treated` : toute ligne principale ou alternative compte.
 * Sur dossier validé / traité : seulement si le produit apparaît encore sur une ligne **retenue** et **non écartée**
 * (ou comme alternative sous une telle ligne).
 */
function pharmacistProposedProductIdBlocked(
  productId: string,
  rows: ItemRow[],
  draft: Draft,
  requestStatus: string | null
): boolean {
  const onlyActiveRetained = requestStatus != null && ["confirmed", "treated"].includes(requestStatus);

  for (const row of rows) {
    if (row.product_id === productId) {
      if (!onlyActiveRetained) return true;
      if (row.is_selected_by_patient && !effectiveWithdrawnAfterConfirm(row, draft)) return true;
    } else {
      for (const alt of normalizeAlts(row.request_item_alternatives)) {
        if (alt.product_id !== productId) continue;
        if (!onlyActiveRetained) return true;
        if (row.is_selected_by_patient && !effectiveWithdrawnAfterConfirm(row, draft)) return true;
        break;
      }
    }
  }
  return false;
}

/** Mise à jour ligne : payload dispo/prix + pour ajout officine produit, `requested_qty` / `selected_qty` = qté offerte. */
function buildRequestItemUpdatePayloadForPharmacistSave(f: ItemDraft, row: ItemRow, requestType: string) {
  const base = buildItemUpdatePayload(f, row, requestType);
  if (isPrescriptionOrdonnancePharmacistLine(requestType, row)) {
    const req = ordonnanceDraftRequestedQty(row, f);
    return {
      ...base,
      requested_qty: req,
      selected_qty: req,
    };
  }
  if (!isPharmacistProposedRow(row) || !isProductRequestAjoutOfficineLine(requestType, row)) return base;
  const n = clampRequestItemQty(Number(f.available_qty));
  return {
    ...base,
    requested_qty: n,
    selected_qty: n,
  };
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
      productName: one(row.products)?.name ?? "Produit",
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
    isProp &&
    isPrescriptionOrdonnancePrincipalLine(requestType, row, []);
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
    let fromAlt =
      chosenAlt!.available_qty != null ? Number(chosenAlt!.available_qty) : selBase;
    if (!Number.isFinite(fromAlt)) fromAlt = selBase;
    availNum = Math.max(0, Math.min(cap, Math.floor(fromAlt)));
  } else {
    const rowAvailStatus = row.availability_status ?? "available";
    if (
      isOrdonnancePharma &&
      (rowAvailStatus === "market_shortage" || rowAvailStatus === "unavailable")
    ) {
      availNum = row.available_qty != null ? Number(row.available_qty) : 0;
    } else {
      availNum = row.available_qty != null ? Number(row.available_qty) : Number(row.requested_qty);
    }
    if (!Number.isFinite(availNum)) availNum = isOrdonnancePharma ? 0 : reqCap;
    if (isAjoutOfficine) {
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
  return {
    ...built,
    ...prev,
    ...supplyFromBuilt,
    withdrawn_after_confirm: built.withdrawn_after_confirm,
    selected_qty_str: built.selected_qty_str,
    fulfillment_draft: built.fulfillment_draft,
  };
}

/** Après flush des propositions locales : réassocie le brouillon aux `request_items` persistés. */
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
    next[row.id] = mergeItemDraftOnReload(row, built, prev, requestStatus);
  }
  return next;
}

function computeSupplyStructuralDirty(
  request: { status: string; request_type: string } | null,
  items: ItemRow[],
  draft: Draft,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  altQtyDrafts: Record<string, string>
): boolean {
  if (!request || !["confirmed", "treated"].includes(request.status)) return false;
  if (pendingProposalRows.length > 0) return true;
  if (pendingAlternatives.length > 0) return true;
  for (const row of items) {
    const d = draft[row.id];
    if (!d) continue;
    const b = buildItemDraftFromRow(row, request?.status ?? null, request?.request_type);
    if (d.withdrawn_after_confirm !== b.withdrawn_after_confirm) return true;
    if (d.availability_status !== b.availability_status) return true;
    if (d.available_qty !== b.available_qty) return true;
    if (d.unit_price !== b.unit_price) return true;
    if (d.pharmacist_comment !== b.pharmacist_comment) return true;
    if (d.expected_availability_date !== b.expected_availability_date) return true;
  }

  for (const row of items) {
    const alts = normalizeAlts(row.request_item_alternatives);
    for (const alt of alts) {
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
};

function takeRespondedEditSnapshot(
  draft: Draft,
  altQtyDrafts: Record<string, string>,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[]
): RespondedEditSnapshot {
  return {
    draft: JSON.parse(JSON.stringify(draft)) as Draft,
    altQtyDrafts: { ...altQtyDrafts },
    pendingProposalIds: pendingProposalRows.map((r) => r.id).join(","),
    pendingAlternativesJson: JSON.stringify(pendingAlternatives),
  };
}

function diffRespondedSnapshots(
  baseline: RespondedEditSnapshot,
  displayRows: ItemRow[],
  draft: Draft,
  altQtyDrafts: Record<string, string>,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[]
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
    const nm = one(row.products)?.name ?? "Produit";
    if (a.availability_status !== b.availability_status) bits.push("disponibilité");
    if (a.available_qty !== b.available_qty) bits.push("stock");
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

function buildSupplyStructuralAmends(
  items: ItemRow[],
  draft: Draft,
  requestType: string,
  lineModifyConsent: Record<string, { channel: string; motive: string }> = {}
): SupplyAmendmentEntryJson[] {
  const out: SupplyAmendmentEntryJson[] = [];
  for (const row of items) {
    const f = draft[row.id];
    if (!f) continue;
    const nm = one(row.products)?.name ?? "Produit";
    if (Boolean(f.withdrawn_after_confirm)) {
      continue;
    }
    if (!lineModifyConsent[row.id]?.channel?.trim()) {
      continue;
    }
    let payload: ReturnType<typeof buildItemUpdatePayload>;
    try {
      payload = buildItemUpdatePayload(f, row, requestType);
    } catch {
      continue;
    }
    const persisted = supplyRowPersistedSupplyFields(row);
    const qtyChanged = persisted.available_qty !== (payload.available_qty ?? null);
    const avChanged = persisted.availability_status !== (payload.availability_status ?? null);
    const priceChanged = !unitPricesEqualForSupplyAmend(persisted.unit_price, payload.unit_price);
    const ccRow = (persisted.pharmacist_comment ?? "").trim();
    const ccNew = (payload.pharmacist_comment ?? "").trim();
    const ccChanged = ccRow !== ccNew;
    const dRow = (persisted.expected_availability_date ?? "").trim();
    const dNew = (payload.expected_availability_date ?? "").trim().slice(0, 10);
    const dateChanged = dRow !== dNew;
    if (qtyChanged || avChanged || priceChanged || ccChanged || dateChanged) {
      const bits: string[] = [];
      if (avChanged) {
        bits.push(
          `disponibilité « ${availabilityStatusFr[persisted.availability_status ?? ""] ?? persisted.availability_status ?? "—"} » → « ${availabilityStatusFr[payload.availability_status] ?? payload.availability_status} »`
        );
      }
      if (qtyChanged) bits.push(`quantité officine ${persisted.available_qty ?? "—"} → ${payload.available_qty}`);
      if (priceChanged) bits.push("prix unitaire");
      if (dateChanged) bits.push("date de disponibilité");
      if (ccChanged) bits.push("commentaire officine");
      out.push({
        kind: "line_adjust_supply",
        request_item_id: row.id,
        summary: `${nm} — ${bits.join(", ")}`,
        detail: bits.join(" · "),
      });
    }
  }
  return out;
}

function buildConfirmedSupplySaveSummaryLines(
  items: ItemRow[],
  draft: Draft,
  pendingProposalRows: ItemRow[],
  pendingAlternatives: PendingAlternativeEntry[],
  altQtyDrafts: Record<string, string>,
  lineModifyConsent: Record<string, { channel: string; motive: string }>,
  requestStatus: string | null,
  requestType: string,
  pharmacistProposedBadge: string,
  /** Si défini, seuls ces ids ont un « accord patient » listé (aligné sur les lignes réellement enregistrées). */
  consentRowIdFilter?: Set<string> | null
): string[] {
  const lines: string[] = [];

  for (const row of pendingProposalRows) {
    const nm = one(row.products)?.name ?? "Produit";
    lines.push(`${pharmacistProposedBadge} à créer : « ${nm} » (${row.requested_qty ?? 1} unité(s)).`);
  }

  for (const pe of pendingAlternatives) {
    const parent = items.find((i) => i.id === pe.parentItemId) ?? null;
    const pnm = parent ? validatedProductLabel(parent as PatientLineLike) : "ligne";
    const anm = one(pe.products)?.name ?? "Alternative";
    lines.push(`Nouvelle alternative à enregistrer sur « ${pnm} » : « ${anm} ».`);
  }

  const consentRowIds = Object.keys(lineModifyConsent)
    .filter((rid) => lineModifyConsent[rid]?.channel?.trim())
    .filter((rid) => !consentRowIdFilter || consentRowIdFilter.has(rid));
  if (consentRowIds.length > 0) {
    const labels = consentRowIds.map((rid) => {
      const r = items.find((i) => i.id === rid);
      return r ? validatedProductLabel(r as PatientLineLike) : rid.slice(0, 8);
    });
    lines.push(
      `Accord patient (canal / précision) enregistré avec la sauvegarde pour : ${labels.map((l) => `« ${l} »`).join(", ")}.`
    );
  }

  const amends = buildSupplyStructuralAmends(items, draft, requestType, lineModifyConsent);
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
        lines.push(`« ${nm} » : écarter la ligne après validation (retrait du suivi actif).`);
      } else {
        lines.push(`« ${nm} » : rétablir la ligne hors écart (retour dans le suivi actif).`);
      }
    }
    if (
      (d.counter_outcome_draft ?? "unset") !== (row.counter_outcome ?? "unset") ||
      (d.counter_cancel_reason_draft ?? null) !== (row.counter_cancel_reason ?? null) ||
      String(d.counter_cancel_detail_draft ?? "").trim() !== String(row.counter_cancel_detail ?? "").trim()
    ) {
      const before = counterOutcomeLabelPharmacien(row.counter_outcome ?? "unset", row.counter_cancel_reason ?? null);
      const after = counterOutcomeLabelPharmacien(
        d.counter_outcome_draft ?? "unset",
        d.counter_cancel_reason_draft ?? null
      );
      lines.push(`« ${nm} » — comptoir : « ${before} » → « ${after} ».`);
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

/** Liste déroulante (pas de `<select>` natif / pas de bouton Terminé sur mobile). */
function PharmacienAvailabilityDropdown({
  rowId,
  disabled,
  menuOpen,
  onOpenChange,
  draftStatus,
  requestedQty,
  availableQtyStr,
  isProposedLine,
  options,
  onPick,
}: {
  rowId: string;
  disabled: boolean;
  menuOpen: boolean;
  onOpenChange: (open: boolean) => void;
  draftStatus: string;
  requestedQty: number;
  availableQtyStr: string;
  isProposedLine: boolean;
  options: readonly { value: string; label: string }[];
  onPick: (value: string) => void;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [menuRect, setMenuRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const qty = Number(availableQtyStr || "0");
  const q = Number.isFinite(qty) ? qty : 0;
  const inferred = inferAvailabilityStatusFromQty({
    status: draftStatus,
    availableQty: q,
    requestedQty,
    isProposedLine,
  });
  const ui = availabilityStatusUi(inferred);
  const CurIcon = ui.Icon;

  useLayoutEffect(() => {
    if (!menuOpen || !anchorRef.current) {
      setMenuRect(null);
      return undefined;
    }
    const sync = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vw = typeof window !== "undefined" ? window.innerWidth : 400;
      const width = Math.max(r.width, 200);
      let left = r.left;
      if (left + width > vw - 8) {
        left = Math.max(8, vw - width - 8);
      }
      setMenuRect({
        top: r.bottom + 4,
        left,
        width,
      });
    };
    sync();
    window.addEventListener("scroll", sync, true);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, [menuOpen]);

  return (
    <div ref={anchorRef} className="relative min-w-[8.5rem] flex-1" data-pharma-avail-anchor={rowId}>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (disabled) return;
          onOpenChange(!menuOpen);
        }}
        className={clsx(
          "flex h-9 w-full items-center gap-2 rounded-xl border border-input bg-background px-2 text-left text-[11px] font-semibold shadow-sm transition hover:bg-muted/35 disabled:opacity-55",
          menuOpen && "ring-2 ring-primary/25"
        )}
      >
        <CurIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{ui.label}</span>
        <ChevronDown className={clsx("size-4 shrink-0 text-muted-foreground transition-transform", menuOpen && "rotate-180")} />
      </button>
      {menuOpen && menuRect && typeof document !== "undefined"
        ? createPortal(
            <ul
              role="listbox"
              aria-label="Disponibilité"
              data-pharma-avail-menu={rowId}
              style={{
                position: "fixed",
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                zIndex: 10050,
                maxHeight: "min(14rem, 55vh)",
              }}
              className="space-y-0.5 overflow-auto rounded-xl border border-border/90 bg-card py-1 shadow-xl ring-1 ring-black/[0.08]"
            >
              {options.map((o) => {
                const inferredOpt = inferAvailabilityStatusFromQty({
                  status: o.value,
                  availableQty: q,
                  requestedQty,
                  isProposedLine,
                });
                const oUi = availabilityStatusUi(inferredOpt);
                const OIcon = oUi.Icon;
                const selected = draftStatus === o.value;
                return (
                  <li key={o.value} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={clsx(
                        "flex w-full items-center gap-2 px-2.5 py-2 text-left text-[11px] font-medium transition",
                        selected
                          ? "bg-primary/12 text-primary"
                          : "text-foreground hover:bg-muted/65"
                      )}
                      onClick={() => {
                        onPick(o.value);
                        onOpenChange(false);
                      }}
                    >
                      <OIcon className="size-3.5 shrink-0 opacity-90" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </div>
  );
}

export default function PharmacienDemandeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState<RequestRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [draft, setDraft] = useState<Draft>({});
  const [altRowsOpen, setAltRowsOpen] = useState<Record<string, boolean>>({});
  const [altPickerOpenFor, setAltPickerOpenFor] = useState<string | null>(null);
  const [availabilityMenuRowId, setAvailabilityMenuRowId] = useState<string | null>(null);
  const [altQuery, setAltQuery] = useState("");
  const [altHits, setAltHits] = useState<ProductCatalogHit[]>([]);
  const [altBusyRow, setAltBusyRow] = useState<string | null>(null);
  const [counterBusyId, setCounterBusyId] = useState<string | null>(null);
  const [fulfillmentRpcBusyId, setFulfillmentRpcBusyId] = useState<string | null>(null);
  const [completeBusy, setCompleteBusy] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [declareTreatedBusy, setDeclareTreatedBusy] = useState(false);
  const [supplyConfirmOpen, setSupplyConfirmOpen] = useState(false);
  const [supplyConfirmBusy, setSupplyConfirmBusy] = useState(false);
  const [supplyConfirmBlocks, setSupplyConfirmBlocks] = useState<SupplyConfirmBlock[]>([]);
  const [supplyConfirmPending, setSupplyConfirmPending] = useState<
    | { kind: "unlock_modify"; rowId: string }
    | { kind: "add_line"; pick: ProductCatalogHit; reason: string; qty: number }
    | { kind: "withdraw_line"; rowId: string }
    | { kind: "remove_proposed_line"; row: ItemRow }
    | null
  >(null);
  const [lineModifyConsent, setLineModifyConsent] = useState<Record<string, { channel: string; motive: string }>>({});
  const [supplyMenuRowId, setSupplyMenuRowId] = useState<string | null>(null);
  const [pharmaHistoryRowId, setPharmaHistoryRowId] = useState<string | null>(null);
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
  const [consultationTab, setConsultationTab] = useState<ConsultationDetailTab>("conversation");
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [prescriptionPaths, setPrescriptionPaths] = useState<PrescriptionPagePaths | null>(null);
  const [prescriptionNote, setPrescriptionNote] = useState<string | null>(null);
  const [consultationBrief, setConsultationBrief] = useState<{
    text: string;
    paths: ConsultationImagePaths;
  } | null>(null);
  /** Après publication (`responded`), affichage figé jusqu'à « Modifier ». */
  const [respondedEditMode, setRespondedEditMode] = useState(false);
  const [respondedSaveConfirmOpen, setRespondedSaveConfirmOpen] = useState(false);
  const [respondedSaveDiffLines, setRespondedSaveDiffLines] = useState<string[]>([]);
  const [supplySaveConfirmOpen, setSupplySaveConfirmOpen] = useState(false);
  const [supplySaveConfirmLines, setSupplySaveConfirmLines] = useState<string[]>([]);
  const respondedEditBaselineRef = useRef<RespondedEditSnapshot | null>(null);
  const prevRespondedEditMode = useRef(false);
  /** Modal échanges patient / officine sur une ligne (id `request_items`). */
  const [lineConvoRowId, setLineConvoRowId] = useState<string | null>(null);
  /** Lignes proposées / alternatives encore non écrites en base tant que réponse pas publiée ou enregistrée (hors `confirmed`). */
  const [pendingProposalRows, setPendingProposalRows] = useState<ItemRow[]>([]);
  const [pendingAlternatives, setPendingAlternatives] = useState<PendingAlternativeEntry[]>([]);
  /** Saisie quantité alternative (id alternative locale ou UUID). */
  const [altQtyDrafts, setAltQtyDrafts] = useState<Record<string, string>>({});
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const altDebounced = useMemo(() => altQuery.trim(), [altQuery]);
  const altVisibleHits = altDebounced.length < 2 ? [] : altHits;

  const [propOpen, setPropOpen] = useState(false);
  const [propQuery, setPropQuery] = useState("");
  const [propHits, setPropHits] = useState<ProductCatalogHit[]>([]);
  const [propReason, setPropReason] = useState("");
  const [propQty, setPropQty] = useState("1");
  const [propBusy, setPropBusy] = useState(false);
  const [ordonnanceQuickAddOpen, setOrdonnanceQuickAddOpen] = useState(false);
  const [ordonnanceQuickNote, setOrdonnanceQuickNote] = useState("");
  const [ordonnanceQuickAvailability, setOrdonnanceQuickAvailability] = useState("available");
  const [ordonnanceQuickExpectedDate, setOrdonnanceQuickExpectedDate] = useState("");
  const [ordonnanceQuickRequestedQty, setOrdonnanceQuickRequestedQty] = useState("1");
  const [ordonnanceQuickAvailableQty, setOrdonnanceQuickAvailableQty] = useState("1");
  const [ordonnanceQuickAddPick, setOrdonnanceQuickAddPick] = useState<ProductCatalogHit | null>(null);
  const [ordonnanceQuickAlternatives, setOrdonnanceQuickAlternatives] = useState<ProductCatalogHit[]>([]);
  const [ordonnanceAltQuery, setOrdonnanceAltQuery] = useState("");
  const [ordonnanceAltHits, setOrdonnanceAltHits] = useState<ProductCatalogHit[]>([]);
  const propCatalogSearchActive = useMemo(
    () =>
      propOpen ||
      ordonnanceQuickAddOpen ||
      (request?.request_type === "free_consultation" && consultationTab === "products"),
    [propOpen, ordonnanceQuickAddOpen, request?.request_type, consultationTab]
  );
  const ordonnanceAltDebounced = useMemo(() => ordonnanceAltQuery.trim(), [ordonnanceAltQuery]);
  const propDebounced = useMemo(() => propQuery.trim(), [propQuery]);
  const propVisibleHits =
    !propCatalogSearchActive || propDebounced.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS ? [] : propHits;

  /** Avant première réponse : aucune ligne `pharmacist_proposed` ne doit subsister en base (anciens inserts). */
  const hideStaleServerPharmacistProposals = useMemo(
    () =>
      !!request &&
      request.request_type === "product_request" &&
      !["confirmed", "treated"].includes(request.status) &&
      ["submitted", "in_review"].includes(request.status),
    [request]
  );

  const deferPersistOfficineAdditions = useMemo(
    () =>
      !!request &&
      !["confirmed", "treated"].includes(request.status) &&
      (["submitted", "in_review"].includes(request.status) ||
        (request.status === "responded" && respondedEditMode)),
    [request, respondedEditMode]
  );

  const displayRows = useMemo(() => {
    const baseRows = hideStaleServerPharmacistProposals
      ? items.filter((r) => r.line_source !== "pharmacist_proposed")
      : items.slice();
    const withSynthetic = [...baseRows, ...pendingProposalRows];
    return mergePendingAlternativesOntoRows(withSynthetic, pendingAlternatives);
  }, [items, hideStaleServerPharmacistProposals, pendingProposalRows, pendingAlternatives]);

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
        .select("consultation_text,image_1_path,image_2_path,image_3_path")
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
        };
        setConsultationBrief({
          text: cr.consultation_text,
          paths: { photo1: cr.image_1_path, photo2: cr.image_2_path, photo3: cr.image_3_path },
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

    /** Ne pas réécraser le brouillon des lignes encore présentes (ex. après insert ligne proposée + reload). */
    setDraft((prev) => {
      const next: Draft = {};
      for (const row of list) {
        const built = buildItemDraftFromRow(row, r.status, r.request_type);
        next[row.id] = mergeItemDraftOnReload(row, built, prev[row.id], r.status);
      }
      return next;
    });
    setLoading(false);
  }, [id, router]);

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
        const eta = effectiveEtaSupplyDraft(rowSnap, liveDraft, request?.request_type);
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
      setFulfillmentRpcBusyId(rowSnap.id);
      setError("");
      try {
        const { error } = await supabase.rpc("pharmacist_set_post_confirm_fulfillment", {
          p_request_item_id: rowSnap.id,
          p_fulfillment: next,
        });
        if (error) throw new Error(error.message);
        dispatchRequestDetailRefresh(id);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible d’enregistrer.");
      } finally {
        setFulfillmentRpcBusyId(null);
      }
    },
    [id, load, request?.status, request?.request_type, draft]
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
          .select("id,name,product_type,laboratory,photo_url,price_pph")
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
          .select("id,name,product_type,laboratory,photo_url,price_pph")
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
    if (!request || request.request_type !== "free_consultation") return;
    const tid = window.setTimeout(() => {
      setConsultationTab(getConsultationDefaultTab(request.status, request.responded_at));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [request]);

  useEffect(() => {
    if (!request || request.request_type !== "free_consultation" || consultationTab !== "products") return;
    const tid = window.setTimeout(() => {
      setPropOpen(true);
      const reason = getRequestKindWorkflowCopy("free_consultation").pharmacistProposeDefaultReason;
      if (reason) setPropReason(reason);
    }, 0);
    return () => window.clearTimeout(tid);
  }, [request, consultationTab]);

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
          .select("id,name,product_type,laboratory,photo_url,price_pph")
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
    const isOrdonnancePharma =
      request != null && isPrescriptionOrdonnancePharmacistLine(request.request_type, row);
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
        qty = isAjoutOfficine ? Math.max(1, qty || Number(row.requested_qty) || 1) : Math.min(cap, refR);
      }
      if (nextStatus === "available" && qty <= 0) {
        qty = isAjoutOfficine ? 1 : Math.min(cap, refR);
      }
      const minQty = isAjoutOfficine ? 1 : 0;
      const nextAvailNum = Math.max(minQty, Math.min(cap, qty));
      if (isOrdonnancePharma) {
        const patch = applyOrdonnanceAvailabilityChange(nextStatus, refR, nextAvailNum);
        const inferredStatus = inferAvailabilityStatusFromQty({
          status: patch.availability,
          availableQty: patch.availableQty,
          requestedQty: refR,
          isProposedLine: false,
        });
        const fulfillment_draft = clampFulfillmentDraftToInferred(current.fulfillment_draft, inferredStatus);
        return {
          ...prev,
          [row.id]: {
            ...current,
            availability_status: inferredStatus,
            available_qty: String(patch.availableQty),
            fulfillment_draft,
          },
        };
      }
      const nextAvail = String(nextAvailNum);
      const inferred = inferAvailabilityStatusFromQty({
        status: nextStatus,
        availableQty: Number(nextAvail),
        requestedQty: refR,
        isProposedLine: isAjoutOfficine,
      });
      const fulfillment_draft = clampFulfillmentDraftToInferred(current.fulfillment_draft, inferred);
      return {
        ...prev,
        [row.id]: {
          ...current,
          availability_status: nextStatus,
          available_qty: nextAvail,
          fulfillment_draft,
        },
      };
    });
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

  const setAvailableQty = (row: ItemRow, raw: string) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage") return;
    const isAjoutOfficine =
      request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
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
      const n = Math.min(max, Math.max(1, Number(digits)));
      const nextQty = Number.isFinite(n) ? n : 1;
      setDraft((prev) => {
        const cur = prev[row.id];
        if (!cur) return prev;
        const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, "to_order");
        return {
          ...prev,
          [row.id]: {
            ...cur,
            available_qty: String(nextQty),
            availability_status: "to_order",
            fulfillment_draft,
          },
        };
      });
      return;
    }
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "") {
      setField(row.id, "available_qty", "");
      return;
    }
    const n = Math.min(max, Math.max(isAjoutOfficine ? 1 : 0, Number(digits)));
    const nextQty = Number.isFinite(n) ? n : 0;
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: nextQty,
      requestedQty: inferRequestedQtyForAvailability(row),
      isProposedLine: isAjoutOfficine,
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = inferred;
      const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, nextStatus);
      return {
        ...prev,
        [row.id]: {
          ...cur,
          available_qty: String(nextQty),
          availability_status: nextStatus,
          fulfillment_draft,
        },
      };
    });
  };

  const nudgeAvailableQty = (row: ItemRow, delta: number) => {
    const status = draft[row.id]?.availability_status ?? "available";
    if (status === "market_shortage") return;
    const isAjoutOfficine =
      request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
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
        const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, "to_order");
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
      return;
    }
    const current = Number(draft[row.id]?.available_qty ?? "0");
    const floor = isAjoutOfficine ? 1 : 0;
    const next = Math.min(
      max,
      Math.max(floor, Number.isFinite(current) ? current + delta : delta > 0 ? 1 : 0)
    );
    const inferred = inferAvailabilityStatusFromQty({
      status: "available",
      availableQty: next,
      requestedQty: inferRequestedQtyForAvailability(row),
      isProposedLine: isAjoutOfficine,
    });
    setDraft((prev) => {
      const cur = prev[row.id];
      if (!cur) return prev;
      const nextStatus = inferred;
      const fulfillment_draft = clampFulfillmentDraftToInferred(cur.fulfillment_draft, nextStatus);
      return {
        ...prev,
        [row.id]: {
          ...cur,
          available_qty: String(next),
          availability_status: nextStatus,
          fulfillment_draft,
        },
      };
    });
  };

  const resetAltPicker = () => {
    setAltPickerOpenFor(null);
    setAltQuery("");
    setAltHits([]);
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
    if (!isPharmacistProposedRow(row)) return;
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
    if (["confirmed", "treated"].includes(request.status)) {
      const nm = one(row.products)?.name ?? "Produit";
      setSupplyConfirmBlocks([
        {
          key: `rm-prop-${row.id}`,
          title: "Retirer la proposition officine",
          subtitle: `${nm} — journalisation pour le patient (canal d’accord obligatoire).`,
        },
      ]);
      setSupplyConfirmPending({ kind: "remove_proposed_line", row });
      setSupplyConfirmOpen(true);
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
      alternatives?: ProductCatalogHit[];
    }
  ) => {
    if (!id) return;
    setError("");
    let reason = propReason.trim();
    const isOrdonnanceInsert =
      request?.request_type === "prescription" &&
      (opts?.lineKind === "ordonnance" || opts?.fromQuickAdd);
    if (request?.request_type === "prescription") {
      reason = isOrdonnanceInsert
        ? PRESCRIPTION_ORDONNANCE_REASON
        : reason.length >= 3
          ? reason
          : PRESCRIPTION_ADDITIONAL_PROPOSED_REASON;
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
      : Math.min(
          PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX,
          Math.max(1, opts?.qty ?? (parseInt(propQty, 10) || 1))
        );
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
    const availRaw = opts?.availability ?? (isPrescriptionInsert ? availRawForInsert : "available");
    const avail = isPrescriptionInsert
      ? inferAvailabilityStatusFromQty({
          status: availRaw,
          availableQty,
          requestedQty,
          isProposedLine: false,
        })
      : availRaw;
    const pharmacistComment = (opts?.pharmacistComment ?? "").trim() || null;
    const etaYmd = (opts?.expectedAvailabilityDate ?? "").trim();
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
    if (pharmacistProposedProductIdBlocked(pick.id, displayRows, draft, request?.status ?? null)) {
      setError(
        request && ["confirmed", "treated"].includes(request.status)
          ? "Ce produit est déjà sur une ligne encore retenue et non écartée, ou en alternative sur une telle ligne. Écartez ou retirez l’autre occurrence, ou choisissez une autre référence."
          : "Ce produit figure déjà sur la réponse (ligne principale ou alternative). Choisis un autre produit."
      );
      return;
    }
    if (deferPersistOfficineAdditions) {
      const prefPrice =
        pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
      const syntheticId = newLocalProposedId();
      const syntheticRow: ItemRow = {
        id: syntheticId,
        product_id: pick.id,
        requested_qty: requestedQty,
        availability_status: avail,
        available_qty: availableQty,
        unit_price: prefPrice,
        pharmacist_comment: pharmacistComment,
        client_comment: null,
        line_source: "pharmacist_proposed",
        pharmacist_proposal_reason: reason,
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
      setDraft((prev) => ({
        ...prev,
        [syntheticId]: buildItemDraftFromRow(syntheticRow, request?.status ?? null, request?.request_type),
      }));
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
                altValidationError = "Cette alternative figure déjà sur la liste.";
                return prev;
              }
              const rank = nextAltRank(mergedForRank);
              if (rank == null) {
                altValidationError = "Maximum 3 alternatives par ligne.";
                return prev;
              }
              const prefPrice =
                alt.price_pph != null && !Number.isNaN(Number(alt.price_pph))
                  ? Number(alt.price_pph)
                  : null;
              next = [
                ...next,
                {
                  localAltId: newLocalAltId(),
                  parentItemId: syntheticId,
                  rank,
                  product_id: alt.id,
                  availability_status: "available",
                  available_qty: Math.max(1, availableQty),
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
      if (opts?.fromQuickAdd) {
        resetOrdonnanceQuickAddForm();
      } else {
        if (request?.request_type !== "free_consultation") setPropOpen(false);
        resetPropForm();
      }
      return;
    }
    if (request && ["confirmed", "treated"].includes(uiRequestStatus ?? "")) {
      setSupplyConfirmBlocks([
        {
          key: "add-line",
          title: `Ajouter « ${pick.name} »`,
          subtitle: `${qty} unité(s) · Motif : ${reason}`,
        },
      ]);
      setSupplyConfirmPending({ kind: "add_line", pick, reason, qty });
      setSupplyConfirmOpen(true);
      setPropOpen(false);
      resetPropForm();
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
        line_source: "pharmacist_proposed",
        pharmacist_proposal_reason: reason,
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
        const prefPrice =
          alt.price_pph != null && !Number.isNaN(Number(alt.price_pph)) ? Number(alt.price_pph) : null;
        const { error: altErr } = await supabase.from("request_item_alternatives").insert({
          request_item_id: insertedRow.id,
          rank,
          product_id: alt.id,
          availability_status: "available",
          available_qty: Math.max(1, availableQty),
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
    if (deferPersistOfficineAdditions) {
      setAltBusyRow(parentRow.id);
      const prefPrice = pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
      let validationError: string | null = null;
      let added = false;
      flushSync(() => {
        setPendingAlternatives((prev) => {
          const mergedExisting: AltRowDb[] = [
            ...normalizeAlts(parentRow.request_item_alternatives),
            ...pendingAltsAsRankedDb(prev, parentRow.id),
          ];
          if (mergedExisting.some((a) => a.product_id === catalogProductId)) {
            validationError = "Cette alternative figure déjà sur la liste.";
            return prev;
          }
          const rank = nextAltRank(mergedExisting);
          if (rank == null) {
            validationError = "Maximum 3 alternatives par ligne.";
            return prev;
          }
          added = true;
          return [
            ...prev,
            {
              localAltId: newLocalAltId(),
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
        resetAltPicker();
        setAltRowsOpen((prev) => ({ ...prev, [parentRow.id]: true }));
      }
      return;
    }
    const existing = normalizeAlts(parentRow.request_item_alternatives);
    const rank = nextAltRank(existing);
    if (existing.some((a) => a.product_id === catalogProductId)) {
      setError("Cette alternative figure déjà sur la liste.");
      return;
    }
    if (rank == null) {
      setError("Maximum 3 alternatives par ligne.");
      return;
    }
    setAltBusyRow(parentRow.id);
    const prefPrice = pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null;
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
    resetAltPicker();
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
        "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url)"
      )
      .eq("request_item_id", parentRow.id)
      .order("rank", { ascending: true });

    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }

    setItems((prev) =>
      prev.map((r) =>
        r.id === parentRow.id
          ? mapRequestItemRowPhotos({ ...r, request_item_alternatives: altRows ?? [] })
          : r
      )
    );
  };

  const deleteAlternativeRow = async (altId: string, parentRowId?: string) => {
    setError("");
    if (deferPersistOfficineAdditions && isLocalAltId(altId)) {
      setPendingAlternatives((prev) => prev.filter((a) => a.localAltId !== altId));
      if (altPickerOpenFor === parentRowId) resetAltPicker();
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
    if (altPickerOpenFor === parentRowId) resetAltPicker();

    if (parentRowId) {
      const { data: altRows, error: fetchErr } = await supabase
        .from("request_item_alternatives")
        .select(
          "id,rank,product_id,availability_status,available_qty,unit_price,pharmacist_comment,expected_availability_date,products(name,price_pph,photo_url)"
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
      recordAddsAfterConfirm?: { requestId: string; consent: Record<string, { channel: string; motive: string }> };
    }
  ): Promise<Map<string, string>> => {
    if (!id) throw new Error("Requête invalide.");
    if (proposalSnap.length === 0 && altSnap.length === 0) return new Map();

    const proposedIdMap = new Map<string, string>();

    for (const row of proposalSnap) {
      const f = draftSnap[row.id];
      if (!f?.availability_status) {
        throw new Error("Choisis une disponibilité pour chaque ligne (propositions officine).");
      }
      const availQtyRaw = Number(f.available_qty);
      if (Number.isNaN(availQtyRaw) || availQtyRaw < 1) {
        throw new Error("Pour chaque proposition officine, la quantité en stock doit être au moins 1.");
      }
      const qtyLine = Math.min(
        PHARMACIST_PROPOSED_STOCK_CEILING,
        Math.max(1, Math.floor(availQtyRaw))
      );
      const price = f.unit_price.trim() === "" ? null : Number(f.unit_price.replace(",", "."));
      if (f.unit_price.trim() !== "" && (price == null || Number.isNaN(price) || price < 0)) {
        throw new Error("Prix unitaire invalide.");
      }
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
        const fill = rec.consent[row.id];
        if (!fill?.channel?.trim()) {
          throw new Error("Canal d’accord patient requis pour chaque ajout officine avant enregistrement.");
        }
        const nm = one(row.products)?.name ?? "Produit";
        const amendments: SupplyAmendmentEntryJson[] = [
          {
            kind: "line_added_after_confirm",
            request_item_id: inserted.id,
            summary: `${nm} ajouté avec accord patient`,
            detail: `${nm} : proposition officine après validation (${qtyLine} unité(s)).`,
            client_confirmation_channel: fill.channel.trim(),
            client_motive: fill.motive.trim() === "" ? null : fill.motive.trim(),
          },
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
      const reasonStr =
        outcome === "cancelled_at_counter" && cancelReason
          ? `counter_outcome:cancelled_at_counter:${cancelReason}`
          : `counter_outcome:${outcome}`;
      const { error: h } = await logHistory(id, st, st, reasonStr);
      if (h) {
        setError(h.message);
        return;
      }
    }
    await load();
  };

  const declarationTreatedEligible = useMemo(() => {
    if (!request?.status || request.status !== "confirmed") return false;
    for (const i of items) {
      if (!i.is_selected_by_patient) continue;
      const f = draft[i.id];
      if (!f || f.withdrawn_after_confirm) continue;
      const eff = effectiveAvailSupplyDraft(i, f, request?.request_type);
      const persistedPcf = i.post_confirm_fulfillment ?? "unset";
      const draftPcf = f.fulfillment_draft;
      if (eff === "available" || eff === "partially_available") {
        if (draftPcf !== "reserved") return false;
      } else if (eff === "to_order") {
        const eta = effectiveEtaSupplyDraft(i, f, request?.request_type);
        if (!eta || !eta.trim()) return false;
        const ok =
          draftPcf === "ordered" ||
          draftPcf === "arrived_reserved" ||
          persistedPcf === "ordered" ||
          persistedPcf === "arrived_reserved";
        if (!ok) return false;
      } else {
        return false;
      }
    }
    return true;
  }, [request, items, draft]);

  const runDeclareRequestTreated = async () => {
    if (!id) return;
    setDeclareTreatedBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("pharmacist_mark_request_treated", {
      p_request_id: id,
    });
    setDeclareTreatedBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    dispatchRequestDetailRefresh(id);
    await load();
  };

  const saveConfirmedAdjustmentsCore = async (
    structuralEnriched: SupplyAmendmentEntryJson[] | null,
    work?: { items: ItemRow[]; draft: Draft; consent: Record<string, { channel: string; motive: string }> }
  ) => {
    if (!request || !["confirmed", "treated"].includes(request.status) || !id) return;
    const rows = work?.items ?? items;
    const d = work?.draft ?? draft;
    const consentMap = work?.consent ?? lineModifyConsent;
    setBusy(true);
    setError("");
    try {
      for (const row of rows) {
        const f = d[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const qtyPrep = Number(f.available_qty);
        if (Number.isNaN(qtyPrep) || qtyPrep < 0) throw new Error("Quantité disponible invalide sur une ligne.");
        const nm = one(row.products)?.name ?? "ce produit";
        const isAjoutOfficine =
          request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
        if (isAjoutOfficine && qtyPrep < 1 && !f.withdrawn_after_confirm) {
          throw new Error(`« ${nm} » (proposition officine) : quantité en stock minimale 1.`);
        }
        const draftSel = Math.min(999, Math.max(1, Number(f.selected_qty_str) || 1));
        const payload = buildItemUpdatePayload(f, row, request.request_type);
        const inf = inferredAvailabilityForPostConfirmClamp(row, payload.availability_status);
        if (!f.withdrawn_after_confirm && inf === "to_order") {
          const eta = effectiveEtaSupplyDraft(row, f, request.request_type);
          if (!eta || !eta.trim()) {
            throw new Error(
              `« ${nm} » : renseignez la date prévisionnelle de réception pour toute ligne « à commander » avant d’enregistrer.`
            );
          }
        }
        let pcf: "unset" | "reserved" | "ordered" | "arrived_reserved" = f.fulfillment_draft;
        if (f.withdrawn_after_confirm) {
          pcf = "unset";
        } else {
          pcf = clampFulfillmentDraftToInferred(pcf, inf);
        }
        /* Colonne DB NOT NULL (enum, défaut 'unset') : ne jamais envoyer null. */
        const pcfDb: "unset" | "reserved" | "ordered" | "arrived_reserved" = pcf;
        const { error: up } = await supabase
          .from("request_items")
          .update({
            ...payload,
            post_confirm_fulfillment: pcfDb,
            withdrawn_after_confirm: Boolean(f.withdrawn_after_confirm),
            selected_qty: row.is_selected_by_patient && !f.withdrawn_after_confirm ? draftSel : row.selected_qty,
          })
          .eq("id", row.id);
        if (up) throw new Error(up.message);

        const chosenPatchId = row.patient_chosen_alternative_id;
        if (chosenPatchId && !f.withdrawn_after_confirm) {
          const { error: altUpd } = await supabase
            .from("request_item_alternatives")
            .update({
              availability_status: payload.availability_status,
              available_qty: payload.available_qty,
              unit_price: payload.unit_price,
              pharmacist_comment: payload.pharmacist_comment,
              expected_availability_date: payload.expected_availability_date,
            })
            .eq("id", chosenPatchId)
            .eq("request_item_id", row.id);
          if (altUpd) throw new Error(altUpd.message);
        }
      }

      for (const row of rows) {
        const f = d[row.id];
        if (!f) continue;
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
      const histReason = audit ? stringifyPharmaConfirmAudit(audit) : "pharmacist_adjustments_after_confirmation";
      const { error: h } = await logHistory(id, request.status, request.status, histReason);
      if (h) throw new Error(h.message);

      const withdrawAmends: SupplyAmendmentEntryJson[] = [];
      for (const row of rows) {
        const f = d[row.id];
        if (!f || !row.is_selected_by_patient) continue;
        const was = Boolean(row.withdrawn_after_confirm);
        const next = Boolean(f.withdrawn_after_confirm);
        if (was === next) continue;
        if (was && !next) {
          throw new Error(
            `« ${one(row.products)?.name ?? "Produit"} » : la réintégration d’une ligne déjà écartée n’est plus disponible depuis cet écran.`
          );
        }
        const nm = one(row.products)?.name ?? "Produit";
        const fill = consentMap[row.id];
        if (!fill?.channel?.trim()) {
          throw new Error(`Accord patient requis pour écarter « ${nm} ».`);
        }
        withdrawAmends.push({
          kind: "withdraw_after_confirm",
          request_item_id: row.id,
          summary: `${nm} retiré avec accord patient`,
          detail: `${nm} : ligne retirée après validation.`,
          client_confirmation_channel: fill.channel.trim(),
          client_motive: fill.motive.trim() === "" ? null : fill.motive.trim(),
        });
      }

      const allAmends = [...(structuralEnriched ?? []), ...withdrawAmends];
      if (allAmends.length > 0) {
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: id,
          p_amendments: allAmends,
        });
        if (rpcA) throw new Error(rpcA.message);
      }

      dispatchRequestDetailRefresh(id);
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
    const proposalSnapLocal = pendingProposalRows.filter((r) => isLocalProposedItemId(r.id));
    for (const row of proposalSnapLocal) {
      if (
        request.request_type === "prescription" &&
        !prescriptionLineRequiresPatientConsent(request.request_type, row, supplyAmendmentBundles, {
          localOnly: true,
        })
      ) {
        continue;
      }
      const c = lineModifyConsent[row.id];
      if (!c?.channel?.trim()) {
        setError(
          "Pour chaque ajout officine en attente, le canal d’accord est requis (fenêtre ouverte à l’ajout du produit)."
        );
        return;
      }
    }
    for (const row of items) {
      const fd = draft[row.id];
      if (!fd || !row.is_selected_by_patient) continue;
      if (row.withdrawn_after_confirm && !fd.withdrawn_after_confirm) {
        setError(
          "Une ligne déjà écartée et enregistrée ne peut pas être réintégrée depuis cet écran. Rechargez la page si le brouillon semble incohérent."
        );
        return;
      }
    }
    const withdrawTransitionIds = items
      .filter((row) => {
        const fd = draft[row.id];
        if (!fd || !row.is_selected_by_patient) return false;
        const was = Boolean(row.withdrawn_after_confirm);
        const next = Boolean(fd.withdrawn_after_confirm);
        return !was && next;
      })
      .map((r) => r.id);
    const structuralBefore = buildSupplyStructuralAmends(
      items,
      draft,
      request.request_type,
      lineModifyConsent
    );
    const consentRowIdFilter = new Set<string>();
    for (const wid of withdrawTransitionIds) consentRowIdFilter.add(wid);
    for (const row of proposalSnapLocal) consentRowIdFilter.add(row.id);
    for (const e of structuralBefore) {
      if (e.request_item_id) consentRowIdFilter.add(e.request_item_id);
    }
    for (const rid of consentRowIdFilter) {
      const row =
        items.find((r) => r.id === rid) ?? proposalSnapLocal.find((r) => r.id === rid);
      const needsConsent =
        withdrawTransitionIds.includes(rid) ||
        (row
          ? request.request_type === "prescription"
            ? prescriptionLineRequiresPatientConsent(request.request_type, row, supplyAmendmentBundles, {
                localOnly: isLocalProposedItemId(rid),
              })
            : true
          : true);
      if (!needsConsent) continue;
      const c = lineModifyConsent[rid];
      if (!c?.channel?.trim()) {
        const label = row ? validatedProductLabel(row as PatientLineLike) : "cette ligne";
        setError(
          `Canal d’accord patient manquant pour « ${label} ». Ouvrez le menu ⋮ (Modifier ou Écarter) ou l’ajout officine, renseignez le canal, puis enregistrez.`
        );
        return;
      }
    }
    setError("");
    const summaryLines = buildConfirmedSupplySaveSummaryLines(
      items,
      draft,
      pendingProposalRows,
      pendingAlternatives,
      altQtyDrafts,
      lineModifyConsent,
      request?.status ?? null,
      request?.request_type ?? "product_request",
      proposedBadgeLabel,
      consentRowIdFilter
    );
    setSupplySaveConfirmLines(
      summaryLines.length > 0
        ? summaryLines
        : ["Aucun détail supplémentaire : enregistrement des brouillons et du journal patient."]
    );
    setSupplySaveConfirmOpen(true);
  };

  const executeConfirmedSupplySave = async () => {
    if (!request || !id) return;
    const proposalSnapLocal = pendingProposalRows.filter((r) => isLocalProposedItemId(r.id));
    const altSnap = [...pendingAlternatives];
    for (const row of proposalSnapLocal) {
      if (
        request.request_type === "prescription" &&
        !prescriptionLineRequiresPatientConsent(request.request_type, row, supplyAmendmentBundles, {
          localOnly: true,
        })
      ) {
        continue;
      }
      const c = lineModifyConsent[row.id];
      if (!c?.channel?.trim()) {
        setError(
          "Pour chaque ajout officine en attente, le canal d’accord est requis (fenêtre ouverte à l’ajout du produit)."
        );
        setSupplySaveConfirmOpen(false);
        setSupplySaveConfirmLines([]);
        return;
      }
    }
    for (const row of items) {
      const fd = draft[row.id];
      if (!fd || !row.is_selected_by_patient) continue;
      if (row.withdrawn_after_confirm && !fd.withdrawn_after_confirm) {
        setError(
          "Une ligne déjà écartée et enregistrée ne peut pas être réintégrée depuis cet écran. Rechargez la page si le brouillon semble incohérent."
        );
        setSupplySaveConfirmOpen(false);
        setSupplySaveConfirmLines([]);
        return;
      }
    }
    const withdrawTransitionIds = items
      .filter((row) => {
        const fd = draft[row.id];
        if (!fd || !row.is_selected_by_patient) return false;
        const was = Boolean(row.withdrawn_after_confirm);
        const next = Boolean(fd.withdrawn_after_confirm);
        return !was && next;
      })
      .map((r) => r.id);
    const structuralBefore = buildSupplyStructuralAmends(
      items,
      draft,
      request.request_type,
      lineModifyConsent
    );
    const consentRowIdFilterExec = new Set<string>();
    for (const wid of withdrawTransitionIds) consentRowIdFilterExec.add(wid);
    for (const row of proposalSnapLocal) consentRowIdFilterExec.add(row.id);
    for (const e of structuralBefore) {
      if (e.request_item_id) consentRowIdFilterExec.add(e.request_item_id);
    }
    for (const rid of consentRowIdFilterExec) {
      const row =
        items.find((r) => r.id === rid) ?? proposalSnapLocal.find((r) => r.id === rid);
      const needsConsent =
        withdrawTransitionIds.includes(rid) ||
        (row
          ? request.request_type === "prescription"
            ? prescriptionLineRequiresPatientConsent(request.request_type, row, supplyAmendmentBundles, {
                localOnly: isLocalProposedItemId(rid),
              })
            : true
          : true);
      if (!needsConsent) continue;
      const c = lineModifyConsent[rid];
      if (!c?.channel?.trim()) {
        const label = row ? validatedProductLabel(row as PatientLineLike) : "cette ligne";
        setError(
          `Canal d’accord patient manquant pour « ${label} ». Ouvrez le menu ⋮ (Modifier ou Écarter) ou l’ajout officine, renseignez le canal, puis enregistrez.`
        );
        setSupplySaveConfirmOpen(false);
        setSupplySaveConfirmLines([]);
        return;
      }
    }
    try {
      let workItems = [...items];
      let workDraft: Draft = { ...draft };
      const workConsent: Record<string, { channel: string; motive: string }> = { ...lineModifyConsent };
      const workConsentFiltered: Record<string, { channel: string; motive: string }> = {};
      for (const rid of consentRowIdFilterExec) {
        const c = workConsent[rid];
        if (c?.channel?.trim()) workConsentFiltered[rid] = c;
      }

      if (proposalSnapLocal.length > 0) {
        const idMap = await flushDeferredOfficineAdds(workDraft, proposalSnapLocal, altSnap, {
          recordAddsAfterConfirm: { requestId: id, consent: workConsent },
        });
        const { data: freshData, error: freshErr } = await supabase
          .from("request_items")
          .select(PHARMA_REQUEST_ITEMS_SELECT)
          .eq("request_id", id)
          .order("created_at", { ascending: true });
        if (freshErr) throw new Error(freshErr.message);
        workItems = (freshData as ItemRow[]) ?? [];
        workDraft = mergeDraftAfterLocalProposalFlush(workItems, workDraft, idMap, request?.status ?? null);
        for (const [localId, serverId] of idMap) {
          const c = workConsent[localId];
          if (c?.channel?.trim()) {
            workConsent[serverId] = c;
          }
          delete workConsent[localId];
        }
        setPendingProposalRows([]);
        setPendingAlternatives([]);
      }

      const enriched: SupplyAmendmentEntryJson[] | null =
        structuralBefore.length > 0
          ? structuralBefore.map((a) => {
              const rid = a.request_item_id ?? "";
              const fill = rid ? workConsentFiltered[rid] : undefined;
              return {
                ...a,
                client_confirmation_channel: (fill?.channel ?? "autre").trim(),
                client_motive: (fill?.motive ?? "").trim() === "" ? null : (fill?.motive ?? "").trim(),
              };
            })
          : null;
      await saveConfirmedAdjustmentsCore(enriched, { items: workItems, draft: workDraft, consent: workConsentFiltered });
      if (consentRowIdFilterExec.size > 0) {
        setLineModifyConsent((prev) => {
          const next = { ...prev };
          for (const rid of consentRowIdFilterExec) delete next[rid];
          return next;
        });
      }
      setSupplySaveConfirmOpen(false);
      setSupplySaveConfirmLines([]);
    } catch {
      /* setError dans saveConfirmedAdjustmentsCore */
    }
  };

  const applySupplyModalConfirm = async (fills: { channel: string; motive: string }[]) => {
    const pending = supplyConfirmPending;
    if (!pending || !id) return;
    setSupplyConfirmBusy(true);
    setError("");
    let scrollToEditorRowId: string | null = null;
    try {
      if (pending.kind === "unlock_modify") {
        const fill = fills[0];
        if (!fill?.channel?.trim()) throw new Error("Indiquez le canal utilisé.");
        scrollToEditorRowId = pending.rowId;
        setLineModifyConsent((prev) => ({
          ...prev,
          [pending.rowId]: { channel: fill.channel.trim(), motive: (fill.motive ?? "").trim() },
        }));
        const row = items.find((i) => i.id === pending.rowId);
        if (row) {
          setDraft((prev) => {
            const cur = prev[pending.rowId];
            if (!cur) return prev;
            const patch = draftPatchPostConfirmSupplyUnlock(row, cur, request?.status ?? null);
            if (!patch || Object.keys(patch).length === 0) return prev;
            return { ...prev, [pending.rowId]: { ...cur, ...patch } };
          });
        }
      } else if (pending.kind === "add_line") {
        const fill = fills[0];
        if (!fill?.channel?.trim()) throw new Error("Indiquez le canal utilisé.");
        const { pick, reason, qty } = pending;
        if (pharmacistProposedProductIdBlocked(pick.id, displayRows, draft, request?.status ?? null)) {
          throw new Error(
            request && ["confirmed", "treated"].includes(request.status)
              ? "Ce produit est déjà sur une ligne encore retenue et non écartée, ou en alternative sur une telle ligne. Écartez ou retirez l’autre occurrence, ou choisissez une autre référence."
              : "Ce produit figure déjà sur la réponse (ligne principale ou alternative). Choisis un autre produit."
          );
        }
        const syntheticId = newLocalProposedId();
        scrollToEditorRowId = syntheticId;
        const syntheticRow: ItemRow = {
          id: syntheticId,
          product_id: pick.id,
          requested_qty: qty,
          availability_status: "available",
          available_qty: qty,
          unit_price:
            pick.price_pph != null && !Number.isNaN(Number(pick.price_pph)) ? Number(pick.price_pph) : null,
          pharmacist_comment: null,
          client_comment: null,
          line_source: "pharmacist_proposed",
          pharmacist_proposal_reason: reason,
          expected_availability_date: null,
          counter_outcome: "unset",
          counter_cancel_reason: null,
          counter_cancel_detail: null,
          is_selected_by_patient: true,
          selected_qty: qty,
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
        setDraft((prev) => ({
          ...prev,
          [syntheticId]: buildItemDraftFromRow(syntheticRow, request?.status ?? null, request?.request_type),
        }));
        setLineModifyConsent((prev) => ({
          ...prev,
          [syntheticId]: { channel: fill.channel.trim(), motive: (fill.motive ?? "").trim() },
        }));
        setPropOpen(false);
        resetPropForm();
      } else if (pending.kind === "withdraw_line") {
        const fill = fills[0];
        if (!fill?.channel?.trim()) throw new Error("Indiquez le canal utilisé.");
        scrollToEditorRowId = pending.rowId;
        setLineModifyConsent((prev) => ({
          ...prev,
          [pending.rowId]: { channel: fill.channel.trim(), motive: (fill.motive ?? "").trim() },
        }));
        patchItemDraft(pending.rowId, {
          withdrawn_after_confirm: true,
          fulfillment_draft: "unset",
        });
      } else if (pending.kind === "remove_proposed_line") {
        const fill = fills[0];
        if (!fill?.channel?.trim()) throw new Error("Indiquez le canal utilisé.");
        const row = pending.row;
        const nm = one(row.products)?.name ?? "Produit";
        const amendments: SupplyAmendmentEntryJson[] = [
          {
            kind: "line_removed_after_confirm",
            request_item_id: row.id,
            summary: `${nm} retiré après validation (proposition officine)`,
            detail: `${nm} : proposition officine retirée du dossier validé.`,
            client_confirmation_channel: fill.channel.trim(),
            client_motive: fill.motive.trim() === "" ? null : fill.motive.trim(),
          },
        ];
        const { error: rpcA } = await supabase.rpc("pharmacist_record_supply_amendments", {
          p_request_id: id,
          p_amendments: amendments,
        });
        if (rpcA) throw new Error(rpcA.message);
        const { error: delErr } = await supabase
          .from("request_items")
          .delete()
          .eq("id", row.id)
          .eq("line_source", "pharmacist_proposed");
        if (delErr) throw new Error(delErr.message);
        await logHistory(id, request?.status ?? null, request?.status ?? "confirmed", "pharmacist_proposed_line_removed");
        dispatchRequestDetailRefresh(id);
        await load();
      }
      setSupplyConfirmOpen(false);
      setSupplyConfirmPending(null);
      if (scrollToEditorRowId) {
        window.requestAnimationFrame(() => {
          window.setTimeout(() => {
            document
              .querySelector(`[data-pharma-supply-editor="${scrollToEditorRowId}"]`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 200);
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue.");
    }
    setSupplyConfirmBusy(false);
  };

  const saveRespondedAdjustments = async () => {
    if (!request || request.status !== "responded") return;
    setBusy(true);
    setError("");
    const draftSnap = draft;
    const proposalSnap = [...pendingProposalRows];
    const altSnap = [...pendingAlternatives];
    const altDraftSnap = { ...altQtyDrafts };
    try {
      for (const row of displayRows) {
        if (isLocalProposedItemId(row.id)) continue;
        const f = draftSnap[row.id];
        if (!f?.availability_status) throw new Error("Choisis une disponibilité pour chaque ligne.");
        const { error: up } = await supabase
          .from("request_items")
          .update(buildRequestItemUpdatePayloadForPharmacistSave(f, row, request.request_type))
          .eq("id", row.id);
        if (up) throw new Error(up.message);
      }
      await persistAlternativeQtyUpdates(displayRows, altDraftSnap);
      await flushDeferredOfficineAdds(draftSnap, proposalSnap, altSnap);
      setPendingProposalRows([]);
      setPendingAlternatives([]);
      const { error: h } = await logHistory(id, "responded", "responded", "pharmacist_response_updated");
      if (h) throw new Error(h.message);
      setRespondedEditMode(false);
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
      const reqQty = isOrdonnancePharma
        ? ordonnanceDraftRequestedQty(row, f)
        : row.requested_qty;
      if (isAjoutOfficine || request.request_type === "free_consultation") {
        if (qty < 1) {
          const nm = one(row.products)?.name ?? "Produit";
          setError(
            request.request_type === "free_consultation"
              ? `« ${nm} » : indiquez une quantité d’au moins 1.`
              : `« ${nm} » (proposition officine) : indiquez une quantité en stock d’au moins 1.`
          );
          return;
        }
        if (f.availability_status === "to_order" && !f.expected_availability_date.trim()) {
          const nm = one(row.products)?.name ?? "Produit";
          setError(`« ${nm} » : date de réception prévue obligatoire pour un produit à commander.`);
          return;
        }
      } else if (qty > reqQty) {
        const nm = one(row.products)?.name ?? "Produit";
        setError(`« ${nm} » : la quantité en stock ne peut pas dépasser la quantité demandée (${reqQty}).`);
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
    const altDraftSnap = { ...altQtyDrafts };
    const rowsForPublish = [...displayRows];

    try {
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
          payload = buildRequestItemUpdatePayloadForPharmacistSave(f, row, request.request_type);
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
      await load();
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
  const canManageSupplyReadonly =
    request && archiveFrozen && ["confirmed", "treated"].includes(uiRequestStatus ?? "");
  const canManageResponded = uiRequestStatus === "responded" && !archiveFrozen;
  const respondedFrozenView = Boolean(request?.status === "responded" && !respondedEditMode);
  const showLineAndPublishEdits =
    !!request &&
    !archiveFrozen &&
    (["submitted", "in_review"].includes(uiRequestStatus ?? "") ||
      (uiRequestStatus === "responded" && respondedEditMode) ||
      ["confirmed", "treated"].includes(uiRequestStatus ?? ""));
  const usesLineWorkflow =
    request?.request_type === "product_request" ||
    request?.request_type === "prescription" ||
    request?.request_type === "free_consultation";
  const isPrescription = request?.request_type === "prescription";
  const isConsultation = request?.request_type === "free_consultation";
  const ordonnanceCatalogEditable = isPrescription && showLineAndPublishEdits;
  const showConsultationProductsPane = !isConsultation || consultationTab === "products";

  /* Pas de useMemo : `draft` est muté en place — react-hooks/preserve-manual-memoization (React Compiler). */
  const lineEntriesForList =
    request && ["confirmed", "treated"].includes(uiRequestStatus ?? "")
      ? (() => {
          const eff = rowsWithEffectiveWithdrawnForSupply(displayRows, draft);
          const flat = flattenPharmacistSupplyListEntriesStable(eff);
          return flat.length > 0 ? flat : displayRows.map((row) => ({ header: null as string | null, row }));
        })()
      : displayRows.map((row) => ({ header: null as string | null, row }));

  const pharmacistSupplySurfaceGroups = useMemo(() => {
    type Entry = (typeof lineEntriesForList)[number];
    type Surface = "principal" | "secondary" | "neutral";
    if (!request || request.request_type === "free_consultation" || !["confirmed", "treated"].includes(request.status)) {
      return [{ surface: "neutral" as const, entries: lineEntriesForList as Entry[] }];
    }
    const groups: { surface: Surface; entries: Entry[] }[] = [];
    for (const e of lineEntriesForList) {
      if (e.header) {
        const h = e.header.toLowerCase();
        const surface: Surface =
          h.includes("écart") || h.includes("hors bloc") || h.includes("hors périmètre") ? "secondary" : "principal";
        groups.push({ surface, entries: [e] });
      } else if (groups.length > 0) {
        groups[groups.length - 1].entries.push(e);
      } else {
        groups.push({ surface: "principal", entries: [e] });
      }
    }
    return groups.length > 0 ? groups : [{ surface: "neutral" as const, entries: lineEntriesForList as Entry[] }];
  }, [request, lineEntriesForList]);

  /* useMemo retiré : évite react-hooks/preserve-manual-memoization sur ce bloc (React Compiler). */
  const supplyStructuralDirty = computeSupplyStructuralDirty(
    request,
    items,
    draft,
    pendingProposalRows,
    pendingAlternatives,
    altQtyDrafts
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
      respondedEditBaselineRef.current = takeRespondedEditSnapshot(draft, altQtyDrafts, pendingProposalRows, pendingAlternatives);
    }
    if (!respondedEditMode) {
      respondedEditBaselineRef.current = null;
    }
    prevRespondedEditMode.current = respondedEditMode;
  }, [respondedEditMode, request?.status, draft, altQtyDrafts, pendingProposalRows, pendingAlternatives]);

  const publishConfirmGroups = useMemo(() => {
    const all: PublishConfirmRowMeta[] = [];
    for (const r of displayRows) {
      const fd = draft[r.id];
      if (!fd) continue;
      all.push(buildPublishConfirmRowMeta(r, fd, request?.request_type, supplyAmendmentBundles));
    }
    return {
      ready: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "ready"),
      order: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "order"),
      blocked: all.filter((m) => publishConfirmModalGroup(m.inferredKey) === "blocked"),
    };
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
      supplyBundles: supplyAmendmentBundles,
      dossierHistory: dossierHistoryTimeline,
      dossierHistoryDetailParagraphs: pharmacistDossierHistoryDetailParagraphsFr,
      pharmacistProposedOriginLabel: getRequestKindWorkflowCopy(request.request_type).timelinePharmacistProposedOrigin,
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
    setAltQtyDrafts({});
    setLineModifyConsent({});
    setError("");
  }, [resetDraftFromRows]);

  let canCompleteCounter = false;
  let counterClosurePendingTracked = 0;
  if (request && usesLineWorkflow && request.status === "treated") {
    const selectedLines = items.filter((i) => i.is_selected_by_patient);
    const tracked = selectedLines.filter((i) => !i.withdrawn_after_confirm);
    const pickedPersisted = tracked.filter((i) => (i.counter_outcome ?? "unset") === "picked_up").length;
    counterClosurePendingTracked = tracked.filter((i) => (i.counter_outcome ?? "unset") !== "picked_up").length;
    canCompleteCounter = tracked.length > 0 && pickedPersisted === tracked.length;
  }

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

  const showDeclareTreatedSticky =
    usesLineWorkflow &&
    request.status === "confirmed" &&
    !respondedFrozenView &&
    declarationTreatedEligible &&
    canManageSupply;

  const showCloseCounterSticky =
    usesLineWorkflow && request.status === "treated" && !archiveFrozen && canCompleteCounter;

  const showSupplyStatsFooter = usesLineWorkflow && Boolean(canManageSupply) && displayRows.length > 0;
  const showSupplyDirtyBar = Boolean(canManageSupply && supplyStructuralDirty && !ordonnanceQuickAddOpen);

  const showBottomActionSticky = showDeclareTreatedSticky || showCloseCounterSticky;

  let bottomChromePaddingClass = "";
  if (showBottomActionSticky && showSupplyStatsFooter) {
    bottomChromePaddingClass = showSupplyDirtyBar ? "pb-44 sm:pb-[10.5rem]" : "pb-32 sm:pb-[8.75rem]";
  } else if (showBottomActionSticky) {
    bottomChromePaddingClass = showSupplyDirtyBar ? "pb-36 sm:pb-40" : "pb-24 sm:pb-[5.5rem]";
  } else if (showSupplyStatsFooter) {
    bottomChromePaddingClass = showSupplyDirtyBar ? "pb-28 sm:pb-32" : "pb-14 sm:pb-16";
  } else if (showSupplyDirtyBar) {
    bottomChromePaddingClass = "pb-24 sm:pb-28";
  } else if (request.status === "treated" && !archiveFrozen) {
    bottomChromePaddingClass = "pb-20 sm:pb-24";
  }

  return (
    <PageShell
      maxWidthClass="max-w-3xl"
      className={clsx(
        "space-y-2 sm:space-y-3",
        usesLineWorkflow && "bg-slate-50",
        canManageResponded && respondedEditMode && request?.status === "responded" && "pb-28 sm:pb-24",
        bottomChromePaddingClass
      )}
    >
      <RequestDetailBackLink config={kindConfig} viewerRole="pharmacien" />

      {isConsultation ? (
        <ConsultationDetailStickyChrome>
          <RequestKindHeader
            config={kindConfig}
            request={request}
            lineCount={usesLineWorkflow ? displayRows.length : null}
            showPlannedVisit={sharedShowPlannedVisitBlock(request.status)}
            viewerRole="pharmacien"
          />
          <ConsultationDetailTabBar
            tab={consultationTab}
            onTab={setConsultationTab}
            conversationUnread={conversationUnread}
            productLineCount={displayRows.length}
          />
        </ConsultationDetailStickyChrome>
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
            request.status === "cancelled" && "border-rose-200/90 bg-rose-50/55 text-rose-950",
            request.status === "abandoned" && "border-orange-200/90 bg-orange-50/55 text-orange-950",
            request.status === "expired" && "border-amber-200/90 bg-amber-50/55 text-amber-950",
            isPrescription && "ring-1 ring-amber-200/50",
            isConsultation && "ring-1 ring-violet-200/50"
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
            isPrescription
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

      {usesLineWorkflow &&
      request &&
      ["submitted", "in_review"].includes(request.status) &&
      !pharmacistRequestIsHardStopped(request.status) ? (
        <section className="rounded-lg border-2 border-sky-400/35 bg-gradient-to-br from-sky-500/10 via-white to-teal-50/20 px-2.5 py-2 text-[10px] leading-snug text-sky-950 shadow-sm ring-1 ring-sky-300/30 sm:px-3">
          <p className="text-[11px] font-bold leading-tight text-sky-950">File d&apos;attente → votre réponse</p>
          <p className="mt-1 text-sky-900/92">
            Renseignez chaque ligne (dispo, quantités, prix catalogue, alternatives si besoin). Publiez une fois prêt : le patient voit exactement cette réponse jusqu&apos;à sa validation ou une modification de votre part.
          </p>
        </section>
      ) : null}

      {usesLineWorkflow && request?.status === "confirmed" && !pharmacistRequestIsHardStopped(request.status) ? (
        <section className="rounded-lg border border-teal-200/85 bg-gradient-to-r from-teal-50/60 to-white px-2.5 py-2 text-[10px] leading-snug text-teal-950 shadow-sm ring-1 ring-teal-200/35 sm:px-3">
          <p className="text-[11px] font-bold text-teal-950">Commande validée côté patient</p>
          <p className="mt-1 text-teal-900/90">
            Pastilles réservé / commandé / reçu : enregistrement immédiat. Pour écarts, ajouts officine ou retouches de ligne, utilisez la barre du bas puis « Enregistrer les modifications », puis passez en « traitée » pour le comptoir.
          </p>
        </section>
      ) : null}

      {usesLineWorkflow && request?.status === "treated" && !pharmacistRequestIsHardStopped(request.status) ? (
        <section className="rounded-lg border border-violet-200/80 bg-gradient-to-r from-violet-50/50 via-white to-teal-50/20 px-2.5 py-2 text-[10px] leading-snug text-violet-950 shadow-sm ring-1 ring-violet-200/40 sm:px-3">
          <p className="text-[11px] font-bold text-violet-950">Retrait comptoir</p>
          <p className="mt-1 text-violet-900/88">
            Indiquez « Récupéré » sur chaque ligne retenue au fil des passages. Clôturez quand tout est aligné. Les autres changements passent encore par « Enregistrer les modifications ».
          </p>
        </section>
      ) : null}

      {respondedEditMode && request?.status === "responded" && usesLineWorkflow ? (
        <section
          id="pharma-demande-mode-edition"
          className="sticky top-0 z-20 rounded-xl border-2 border-amber-400/90 bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50/90 px-3 py-2 shadow-md ring-1 ring-amber-300/50"
        >
          <p className="text-center text-[11px] font-bold uppercase tracking-wide text-amber-950">Mode modification</p>
          <p className="mt-0.5 text-center text-[10px] leading-snug text-amber-900/90">
            Les changements ne sont visibles par le patient qu&apos;après «&nbsp;Enregistrer&nbsp;» et confirmation.
          </p>
        </section>
      ) : null}

      {respondedFrozenView && usesLineWorkflow ? (
        <section className="rounded-lg border-2 border-amber-300/45 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/25 px-2.5 py-2 text-[10px] leading-snug text-amber-950 shadow-sm ring-1 ring-amber-200/45 sm:px-3 sm:text-[11px]">
          <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
            <span className="shrink-0 rounded-full border border-amber-400/80 bg-white/90 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-amber-950">
              Réponse publiée
            </span>
            <p className="min-w-0 flex-1 font-medium leading-snug text-amber-950/95">
              Visible patient depuis{" "}
              <span className="tabular-nums">{request.responded_at ? formatDateTimeShort24hFr(request.responded_at) : "—"}</span>
              <span className="text-amber-800/70" aria-hidden>
                {" "}
                ·{" "}
              </span>
              MAJ <span className="tabular-nums">{formatDateTimeShort24hFr(request.updated_at)}</span>
              <span className="text-amber-900/85"> — en attente du choix patient.</span>
            </p>
            <InfoHint label="Aide — réponse publiée">
              <p>
                C&apos;est la vision actuelle pour le patient. Pour modifier prix, disponibilités, alternatives ou messages de
                ligne, utilisez «&nbsp;Modifier la réponse&nbsp;», puis enregistrez depuis le bandeau en bas de l&apos;écran.
              </p>
            </InfoHint>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{error}</p>
      ) : null}

      {kindConfig.capabilities.workflowEnabled ? (
        <>
          {isConsultation && consultationTab === "conversation" && consultationBrief ? (
            <div className="mt-2 space-y-3">
              <ConsultationBriefPanel
                requestId={request.id}
                initialText={consultationBrief.text}
                initialPaths={consultationBrief.paths}
                editable={false}
                viewerRole="pharmacien"
              />
              {sessionUserId ? (
                <RequestConversationInline
                  requestId={request.id}
                  viewerRole="pharmacien"
                  currentUserId={sessionUserId}
                  variant="consultation"
                  onMarkedRead={() => setConversationUnread(false)}
                />
              ) : null}
            </div>
          ) : null}

          {isPrescription && request.status === "draft" ? (
            <p className="mt-2 rounded-lg border border-amber-300/80 bg-amber-50/60 p-2.5 text-[11px] leading-snug text-amber-950">
              Envoi patient incomplet (brouillon). Aucune action officine : le patient doit renvoyer l’ordonnance depuis la fiche
              pharmacie. Vous pouvez ignorer cette ligne ou l’annuler si elle traîne.
            </p>
          ) : null}

          {isPrescription && prescriptionPaths?.page1 ? (
            <div className="mb-3 space-y-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-3">
              <PrescriptionImageViewer
                paths={prescriptionPaths}
                layout="desktop-comfort"
                className="lg:sticky lg:top-2"
                allowMobileExpand={ordonnanceCatalogEditable}
                ordonnanceQuickAdd={
                  ordonnanceCatalogEditable
                    ? {
                        lineCount: ordonnanceLineCount,
                        onOpenAdd: () => {
                          setError("");
                          resetOrdonnanceQuickAddForm();
                          if (workflowCopy.pharmacistProposeDefaultReason) {
                            setPropReason(workflowCopy.pharmacistProposeDefaultReason);
                          }
                          setOrdonnanceQuickAddOpen(true);
                        },
                        showMainHint: true,
                      }
                    : undefined
                }
              />
              <div className="space-y-2">
                {prescriptionNote?.trim() ? (
                  <p className="rounded-lg border border-amber-200/70 bg-amber-50/40 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
                    <span className="font-semibold">Message patient : </span>
                    {prescriptionNote.trim()}
                  </p>
                ) : null}
                {showLineAndPublishEdits ? (
                  <p className="rounded-lg border border-amber-200/60 bg-amber-50/50 px-2.5 py-2 text-[11px] font-semibold tabular-nums text-amber-950">
                    {ordonnanceLineCount} produit{ordonnanceLineCount !== 1 ? "s" : ""} ordonnance enregistré
                    {ordonnanceLineCount !== 1 ? "s" : ""}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {showConsultationProductsPane && isConsultation && consultationBrief ? (
            <ConsultationBriefCompact
              text={consultationBrief.text}
              paths={consultationBrief.paths}
              onOpenConversation={() => setConsultationTab("conversation")}
            />
          ) : null}

          {showConsultationProductsPane &&
          (displayRows.length === 0 && !isPrescription && !isConsultation ? (
            <p className="mt-2 text-[11px] text-muted-foreground">Aucune ligne produit.</p>
          ) : (
            <>
              {displayRows.length === 0 && isConsultation && showLineAndPublishEdits ? (
                <p className="mt-2 text-[11px] text-muted-foreground">{workflowCopy.pharmacistEmptyLinesHint}</p>
              ) : null}
              {displayRows.length > 0 ? (
              <>
              <div className="flex flex-wrap items-end justify-between gap-1.5 sm:gap-2">
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
            <span className="text-[10px] text-muted-foreground">{displayRows.length} article(s)</span>
          </div>
          <div className="mt-2 flex flex-col gap-3">
            {pharmacistSupplySurfaceGroups.map((group, gi) => (
              <div
                key={gi}
                className={clsx(
                  group.surface === "principal"
                    ? PHARMACIST_SUPPLY_SURFACE_MAIN
                    : group.surface === "secondary"
                      ? PHARMACIST_SUPPLY_SURFACE_SECOND
                      : PHARMACIST_SUPPLY_SURFACE_NEUTRAL
                )}
              >
                <ul className="flex flex-col gap-2">
                  {group.entries.map(({ header, row }) => {
              const prod = one(row.products);
              const linePph = pphLabel(prod?.price_pph);
              const f = draft[row.id];
              if (!f) return null;
              const draftIndicativePuMad =
                f.unit_price.trim() !== ""
                  ? `${Number(f.unit_price.replace(",", ".")).toFixed(2)}\u00A0MAD`
                  : formatPphMad(prod?.price_pph) ?? "—";
              const co = row.counter_outcome ?? "unset";
              const selected = Boolean(row.is_selected_by_patient);
              const lineLockedTrace = co === "cancelled_at_counter";
              const canEditThisRow = showLineAndPublishEdits && !lineLockedTrace && !archiveFrozen;
              const rowAlts = normalizeAlts(row.request_item_alternatives);
              const chosenAltId = row.patient_chosen_alternative_id ?? null;
              const chosenAltRow = chosenAltId ? rowAlts.find((a) => a.id === chosenAltId) : null;
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
              const isAjoutOfficineLine =
                request != null && isProductRequestAjoutOfficineLine(request.request_type, row);
              const isOrdonnancePrincipalLine =
                request != null &&
                isPrescriptionOrdonnancePrincipalLine(request.request_type, row, supplyAmendmentBundles);
              const isOrdonnancePharmacistLine = isOrdonnancePrincipalLine;
              const isPrescriptionExtraProposed =
                request != null &&
                isPrescriptionAdditionalProposedLine(request.request_type, row, supplyAmendmentBundles);
              const draftAvailQty = Number(f.available_qty);
              const draftRequestedQtyForInfer = isOrdonnancePharmacistLine
                ? ordonnanceDraftRequestedQty(row, f)
                : inferRequestedQtyForAvailability(row);
              const draftInferredStatus = inferAvailabilityStatusFromQty({
                status: f.availability_status,
                availableQty: Number.isFinite(draftAvailQty) ? draftAvailQty : 0,
                requestedQty: draftRequestedQtyForInfer,
                isProposedLine:
                  isAjoutOfficineLine ||
                  request?.request_type === "free_consultation" ||
                  isPrescriptionExtraProposed,
              });
              const statusForBadge =
                lineLockedTrace || respondedFrozenView || !canEditThisRow
                  ? row.availability_status
                  : draftInferredStatus;
              const availUi = availabilityStatusUi(statusForBadge);
              const AvailIcon = availUi.Icon;
              const lineProposedBadge = isOrdonnancePrincipalLine
                ? ordonnanceLineBadge
                : isPrescriptionExtraProposed
                  ? PRESCRIPTION_ADDITIONAL_PROPOSED_REASON
                  : isAjoutOfficineLine || isProposedLine
                    ? proposedBadgeLabel
                    : null;
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
              const availabilityOptions =
                isAjoutOfficineLine || request?.request_type === "free_consultation"
                  ? PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS
                  : PHARMACIST_AVAILABILITY_OPTIONS;

              if (canManageSupply || canManageSupplyReadonly) {
                const pl = row as PatientLineLike;
                const validatedName = validatedProductLabel(pl);
                const validatedQty = validatedQtyForPatientLine(pl);
                const effSupply = effectiveAvailSupplyDraft(row, f, request?.request_type, request?.status);
                const etaSupply = effectiveEtaSupplyDraft(row, f, request?.request_type);
                let availSentence = "";
                if (!selected) availSentence = "Non retenu";
                else if (effSupply === "to_order") {
                  availSentence = `À commander${etaSupply ? ` · dispo indicative ${formatDateShortFr(etaSupply)}` : ""}`;
                } else if (effSupply) availSentence = availabilityStatusFr[effSupply] ?? effSupply;
                else availSentence = "—";

                const branchPrice = validatedBranchUnitPriceMad(pl);
                const lineTot = branchPrice != null ? branchPrice * validatedQty : null;
                const unitLabel = branchPrice != null ? `${branchPrice.toFixed(2)} MAD` : "—";
                const totalLabel = lineTot != null ? `${lineTot.toFixed(2)} MAD` : "—";
                const altProdThumb = chosenAltRow ? one(chosenAltRow.products) : null;
                const thumbUrl = resolvePublicMediaUrl(altProdThumb?.photo_url ?? prod?.photo_url ?? null);
                const hasConsent = Boolean(lineModifyConsent[row.id]?.channel?.trim());
                const consent = lineModifyConsent[row.id];
                const lineCounterLocked = (row.counter_outcome ?? "unset") === "picked_up";
                const canMarkReservedSupply =
                  !archiveFrozen &&
                  uiRequestStatus !== "treated" &&
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  (effSupply === "available" || effSupply === "partially_available");
                const canMarkOrderedSupply =
                  !archiveFrozen &&
                  uiRequestStatus !== "treated" &&
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  effSupply === "to_order";
                const canShowArrivedReservedPill =
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace &&
                  !lineCounterLocked &&
                  effSupply === "to_order" &&
                  (f.fulfillment_draft === "ordered" || f.fulfillment_draft === "arrived_reserved");
                const canMarkPickedUpCounterSupply =
                  request.status === "treated" &&
                  selected &&
                  !withdrawnDraft &&
                  !lineLockedTrace;
                const supplyAvailabilityOptions = isAjoutOfficineLine
                  ? PHARMACIST_PROPOSED_AVAILABILITY_OPTIONS
                  : PHARMACIST_SUPPLY_POST_CONFIRM_AVAILABILITY_OPTIONS;

                const consentChannelBlock = (
                  <div className="space-y-1.5 rounded-md border border-sky-200/80 bg-sky-50/55 p-2">
                    <p className="text-[8px] font-bold uppercase tracking-wide text-sky-950">
                      Accord patient (enregistré avec la ligne)
                    </p>
                    <label className="block text-[9px] font-semibold text-muted-foreground">
                      Canal
                      <select
                        className={clsx(
                          "mt-0.5 h-8 w-full rounded-md border border-input bg-background px-2 text-[11px] font-medium shadow-sm",
                          consent?.channel?.trim() ? "text-foreground" : "text-muted-foreground"
                        )}
                        value={consent?.channel ?? ""}
                        onChange={(e) =>
                          setLineModifyConsent((p) => ({
                            ...p,
                            [row.id]: {
                              channel: e.target.value,
                              motive: p[row.id]?.motive ?? "",
                            },
                          }))
                        }
                      >
                        {SUPPLY_AMEND_CHANNEL_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-[9px] font-semibold text-muted-foreground">
                      Description (optionnelle)
                      <textarea
                        rows={2}
                        value={consent?.motive ?? ""}
                        onChange={(e) =>
                          setLineModifyConsent((p) => ({
                            ...p,
                            [row.id]: {
                              channel: p[row.id]?.channel ?? "",
                              motive: e.target.value.slice(0, 1000),
                            },
                          }))
                        }
                        className="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-sm"
                      />
                    </label>
                  </div>
                );

                const modifyFieldsBlock = (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                      <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          Disponibilité
                        </span>
                        <PharmacienAvailabilityDropdown
                          rowId={row.id}
                          disabled={!canEditThisRow || !hasConsent}
                          menuOpen={availabilityMenuRowId === row.id}
                          onOpenChange={(open) =>
                            setAvailabilityMenuRowId((cur) => (open ? row.id : cur === row.id ? null : cur))
                          }
                          draftStatus={f.availability_status}
                          requestedQty={inferRequestedQtyForAvailability(row)}
                          availableQtyStr={f.available_qty}
                          isProposedLine={isProposedLine}
                          options={supplyAvailabilityOptions}
                          onPick={(v) => setAvailabilityStatus(row, v)}
                        />
                      </div>
                      <label className="flex w-[5.5rem] flex-col gap-0.5">
                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Qté</span>
                        <div className="flex h-9 items-center overflow-hidden rounded-xl border border-input bg-background shadow-sm">
                          <button
                            type="button"
                            disabled={stockMinusDisabled || !hasConsent}
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
                              !hasConsent ||
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
                            disabled={stockPlusDisabled || !hasConsent}
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
                          title={linePph ? `Catalogue : ${linePph}` : undefined}
                        >
                          {draftIndicativePuMad}
                        </p>
                      </div>
                    </div>
                    {canEditThisRow && hasConsent && effectiveAvailSupplyDraft(row, f, request?.request_type) === "to_order" ? (
                      <label className="flex max-w-sm flex-col gap-0">
                        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Date prévision commande
                        </span>
                        <input
                          type="date"
                          min={receptionDateMinYmd}
                          disabled={!canEditThisRow}
                          value={f.expected_availability_date}
                          onChange={(e) => setReceptionDateField(row.id, e.target.value)}
                          className="h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] shadow-sm disabled:opacity-60 sm:w-auto sm:min-w-[9rem]"
                        />
                      </label>
                    ) : null}
                  </div>
                );

                const expandedEditor = (
                  <div
                    data-pharma-supply-editor={row.id}
                    className="scroll-mt-[calc(env(safe-area-inset-top)+5rem)] space-y-1.5"
                  >
                    {withdrawnDraft ? (
                      <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/20 px-2 py-1.5">
                        {!row.withdrawn_after_confirm ? (
                          <>
                            <p className="text-[10px] leading-snug text-muted-foreground">
                              Écart en brouillon — sera journalisé avec le dossier (« Enregistrer les modifications »).
                            </p>
                            {consentChannelBlock}
                            <button
                              type="button"
                              disabled={busy || supplyConfirmBusy}
                              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-[10px] font-semibold text-foreground hover:bg-muted/60 disabled:opacity-45"
                              onClick={() => {
                                patchItemDraft(row.id, {
                                  ...buildItemDraftFromRow(row, request.status, request.request_type),
                                  withdrawn_after_confirm: false,
                                });
                                setLineModifyConsent((p) => {
                                  const n = { ...p };
                                  delete n[row.id];
                                  return n;
                                });
                                setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                                setSupplyMenuRowId(null);
                              }}
                            >
                              Abandonner l&apos;écart (brouillon)
                            </button>
                          </>
                        ) : consent?.motive?.trim() || consent?.channel?.trim() ? (
                          <p className="text-[10px] leading-snug text-muted-foreground">
                            <span className="font-medium text-foreground">Accord :</span>{" "}
                            {supplyAmendChannelLabel(consent?.channel)}
                            {consent?.motive?.trim() ? ` — ${consent.motive.trim()}` : null}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {!withdrawnDraft && hasConsent ? (
                      <div className="space-y-1.5">
                        {consentChannelBlock}
                        <button
                          type="button"
                          disabled={busy || supplyConfirmBusy}
                          className="w-full rounded-md border border-sky-400/80 bg-white px-2 py-1.5 text-[10px] font-semibold text-sky-950 hover:bg-sky-100/80 disabled:opacity-45"
                          onClick={() => {
                            patchItemDraft(row.id, buildItemDraftFromRow(row, request.status, request.request_type));
                            setLineModifyConsent((p) => {
                              const n = { ...p };
                              delete n[row.id];
                              return n;
                            });
                            setAvailabilityMenuRowId((cur) => (cur === row.id ? null : cur));
                            setSupplyMenuRowId(null);
                          }}
                        >
                          Annuler les modifications sur cette ligne
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
                            <select
                              value={counterSelectKeyNormalized(row, f)}
                              disabled={!counterSelectInteractive || busy}
                              onChange={(e) => {
                                const v = e.target.value as "unset" | "picked_up";
                                patchItemDraft(row.id, {
                                  counter_outcome_draft: v,
                                  counter_cancel_reason_draft: null,
                                  counter_cancel_detail_draft: null,
                                });
                              }}
                              className="h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <option value="unset">En attente</option>
                              <option value="picked_up">Récupéré</option>
                            </select>
                          </label>
                          <p className="text-[9px] leading-snug text-muted-foreground">
                            Pour retirer une ligne du dossier validé, utilisez « Écarter la ligne » dans le menu ⋮.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null;

                const lineConvoCompactSlot = (
                  <button
                    type="button"
                    disabled={busy || supplyConfirmBusy || fulfillmentRpcBusyId === row.id}
                    onClick={() => {
                      setSupplyMenuRowId(null);
                      setLineConvoRowId(row.id);
                    }}
                    className={clsx(
                      lineConversationStripButtonClass(lineConvoVisual, {
                        open: lineConvoRowId === row.id,
                        disabled: busy || supplyConfirmBusy,
                      }),
                      "min-w-0 w-full max-w-none flex-1 justify-start"
                    )}
                    aria-label={`Échanges produit · ${lineConversationStripLabel(lineConvoVisual)}`}
                    title="Notes patient et officine"
                  >
                    <MessageCircle className="size-4 shrink-0 text-teal-700" strokeWidth={2.4} aria-hidden />
                    <span className="max-w-[10rem] truncate text-[9px] font-medium leading-tight sm:max-w-[12rem]">
                      {lineConversationStripLabel(lineConvoVisual)}
                    </span>
                  </button>
                );

                return (
                  <Fragment key={row.id}>
                    <PharmacistSupplyCompactLine
                      header={header}
                      validatedName={validatedName}
                      validatedQty={validatedQty}
                      availSentence={availSentence}
                      unitLabel={unitLabel}
                      totalLabel={totalLabel}
                      thumbUrl={thumbUrl}
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
                        } else if (fd.fulfillment_draft === "ordered") {
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
                      hasModifyConsent={hasConsent}
                      busy={busy}
                      supplyConfirmBusy={supplyConfirmBusy}
                      lineCounterLocked={lineCounterLocked}
                      showExpandedEditor={
                        Boolean(canManageSupply) &&
                        selected &&
                        !lineLockedTrace &&
                        !lineCounterLocked &&
                        request.status !== "completed" &&
                        (withdrawnDraft || hasConsent)
                      }
                      supplyMutationsEnabled={Boolean(canManageSupply)}
                      expandedEditor={expandedEditor}
                      treatedCounterSlot={treatedCounterSlot}
                      lineConversationSlot={lineConvoCompactSlot}
                      postConfirmAmendmentBadges={supplyAmendmentBadgeLabelsByItemId[row.id]}
                      menuOpen={supplyMenuRowId === row.id}
                      onMenuOpenChange={(open) => setSupplyMenuRowId(open ? row.id : null)}
                      onMenuModify={() => {
                        if (withdrawnDraft) {
                          setError(
                            "Abandonnez d’abord l’écart en brouillon (bouton sous la ligne), ou enregistrez l’écart avec le dossier, puis modifiez."
                          );
                          setSupplyMenuRowId(null);
                          return;
                        }
                        flushSync(() => {
                          setSupplyConfirmBlocks([
                            {
                              key: `unlock-${row.id}`,
                              title: `Accord patient · ${validatedName}`,
                              subtitle: "Canal obligatoire ; précision optionnelle.",
                            },
                          ]);
                          setSupplyConfirmPending({ kind: "unlock_modify", rowId: row.id });
                          setSupplyConfirmOpen(true);
                        });
                        setSupplyMenuRowId(null);
                      }}
                      onMenuWithdraw={() => {
                        setError("");
                        flushSync(() => {
                          setSupplyConfirmBlocks([
                            {
                              key: `withdraw-${row.id}`,
                              title: `Écarter « ${validatedName} »`,
                              subtitle: "Canal obligatoire ; précision optionnelle.",
                            },
                          ]);
                          setSupplyConfirmPending({ kind: "withdraw_line", rowId: row.id });
                          setSupplyConfirmOpen(true);
                        });
                        setSupplyMenuRowId(null);
                      }}
                      showAjoutOfficineBadge={isAjoutOfficineLine}
                      ajoutOfficineBadgeLabel={proposedBadgeLabel}
                      onMenuHistory={() => setPharmaHistoryRowId(row.id)}
                      withdrawDisabled={lineCounterLocked}
                      withdrawDisabledReason={
                        lineCounterLocked ? "Ligne déjà enregistrée comme récupérée." : null
                      }
                    />
                  </Fragment>
                );
              }

              return (
                <Fragment key={row.id}>
                  {header ? (
                    <li className="list-none pt-1.5 first:pt-0 sm:pt-2">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{header}</div>
                    </li>
                  ) : null}
                  <li
                    className={clsx(
                      "list-none overflow-visible rounded-lg border bg-card shadow-sm ring-1 ring-black/[0.04]",
                      isAjoutOfficineLine
                        ? "border-violet-300/80 bg-gradient-to-b from-violet-50/70 via-white to-white ring-violet-200/50"
                        : isOrdonnancePrincipalLine
                          ? "border-amber-200/85 bg-gradient-to-b from-amber-50/40 via-white to-white ring-amber-200/45"
                          : "border-slate-200/85 bg-gradient-to-b from-white to-slate-50/40 ring-slate-200/50",
                      availUi.accentClass,
                      isAjoutOfficineLine
                        ? "border-l-[3px] border-l-violet-500"
                        : isOrdonnancePrincipalLine
                          ? "border-l-[3px] border-l-amber-500"
                          : "border-l-[3px] border-l-sky-400/55"
                    )}
                  >
                  <div
                    className={clsx(
                      "flex gap-2 border-b px-2 py-1.5 sm:gap-2 sm:px-2.5 sm:py-2",
                      isAjoutOfficineLine
                        ? "border-violet-200/50 bg-gradient-to-r from-violet-50/50 via-white to-transparent"
                        : isOrdonnancePrincipalLine
                          ? "border-amber-100/90 bg-gradient-to-r from-amber-50/40 via-white to-transparent"
                          : "border-slate-100/90 bg-white/90"
                    )}
                  >
                    <div className="flex w-[4.25rem] shrink-0 flex-col items-stretch gap-0.5 sm:w-[4.75rem]">
                      <div
                        className={clsx(
                          "relative h-[4.25rem] w-full overflow-hidden rounded-md border bg-white shadow-inner sm:h-[4.5rem]",
                          isAjoutOfficineLine
                            ? "border-violet-200/80 ring-1 ring-violet-200/35"
                            : isOrdonnancePrincipalLine
                              ? "border-amber-200/80 ring-1 ring-amber-200/35"
                              : "border-slate-200/75"
                        )}
                      >
                        {prod?.photo_url ? (
                          <img
                            src={resolvePublicMediaUrl(prod.photo_url) ?? prod.photo_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Package
                              className={clsx(
                                "size-7 sm:size-8",
                                isAjoutOfficineLine
                                  ? "text-violet-400/90"
                                  : isOrdonnancePrincipalLine
                                    ? "text-amber-500/90"
                                    : "text-slate-400"
                              )}
                              aria-hidden
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="min-w-0 flex-1 break-words text-[13px] font-bold leading-snug text-foreground sm:text-sm">
                            {prod?.name ?? "Produit"}
                          </p>
                          {lineProposedBadge ? (
                            <span
                              className={clsx(
                                "shrink-0 rounded-full px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white",
                                isOrdonnancePharmacistLine || isOrdonnancePrincipalLine
                                  ? "bg-amber-700"
                                  : "bg-violet-600"
                              )}
                            >
                              {lineProposedBadge}
                            </span>
                          ) : null}
                        </div>
                        {canEditThisRow && isProposedLine ? (
                          <button
                            type="button"
                            title="Retirer cette proposition"
                            aria-label="Retirer cette proposition"
                            disabled={busy}
                            onClick={() => void removePharmacistProposedLine(row)}
                            className="shrink-0 rounded-lg border border-rose-200/90 bg-rose-50/90 p-1.5 text-rose-800 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
                          >
                            <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                          </button>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
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
                      <div className="mt-1 flex min-w-0 items-stretch gap-2 border-t border-dotted border-border/55 pt-1.5">
                        <button
                          type="button"
                          disabled={busy}
                          className={clsx(
                            lineConversationStripButtonClass(lineConvoVisual, {
                              open: lineConvoEffectiveRowId === row.id,
                              disabled: busy,
                            }),
                            "relative min-h-9 min-w-0 flex-1 justify-start"
                          )}
                          aria-label={`Échanges produit · ${lineConversationStripLabel(lineConvoVisual)}`}
                          title="Ouvrir les messages patient et note officine"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLineConvoRowId((cur) => (cur === row.id ? null : row.id));
                          }}
                        >
                          <MessageCircle className="size-4 shrink-0 text-teal-700" strokeWidth={2.4} aria-hidden />
                          <span className="min-w-0 flex-1 text-left text-[9px] font-medium leading-snug">
                            {lineConversationStripLabel(lineConvoVisual)}
                          </span>
                          {lineConvoVisual === "patient_only" &&
                          ((canEditThisRow && showLineAndPublishEdits) || (respondedFrozenView && !lineLockedTrace)) ? (
                            <span
                              className="absolute -right-0.5 -top-0.5 flex size-2 rounded-full bg-amber-500 ring-2 ring-white"
                              aria-hidden
                            />
                          ) : null}
                        </button>
                        <div
                          className="flex shrink-0 flex-col justify-center self-stretch border-l border-border/45 pl-2 text-end"
                          title={linePph ? `PPH catalogue : ${linePph}` : undefined}
                        >
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-muted-foreground">
                            PU indicatif
                          </span>
                          <span className="mt-0.5 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-none text-foreground sm:text-[12px]">
                            {draftIndicativePuMad}
                          </span>
                        </div>
                      </div>
                      {isProposedLine ? (
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
                        <div className="rounded-md border border-sky-300/70 bg-sky-50/95 px-1.5 py-1 text-[10px] leading-snug text-sky-950">
                          <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900/90">Choix patient</p>
                          <p className="mt-0.5 font-medium">
                            {chosenAltRow ? (
                              <>
                                <span className="text-sky-800/90">Alternative retenue · </span>
                                <strong>{one(chosenAltRow.products)?.name ?? "Produit"}</strong>
                              </>
                            ) : (
                              <>
                                <span className="text-sky-800/90">Produit principal retenu · </span>
                                <strong>{prod?.name ?? "Produit"}</strong>
                              </>
                            )}
                            <span className="text-sky-900/80">
                              {" "}
                              · Quantité <strong>{row.selected_qty ?? row.requested_qty}</strong>
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
                            disabled={!canEditThisRow || busy || supplyConfirmBusy}
                            onClick={() => {
                              setError("");
                              const nm = validatedProductLabel(row as PatientLineLike);
                              flushSync(() => {
                                setSupplyConfirmBlocks([
                                  {
                                    key: `withdraw-${row.id}`,
                                    title: `Écarter « ${nm} »`,
                                    subtitle: "Canal obligatoire ; précision optionnelle.",
                                  },
                                ]);
                                setSupplyConfirmPending({ kind: "withdraw_line", rowId: row.id });
                                setSupplyConfirmOpen(true);
                              });
                            }}
                            className="rounded-md border border-amber-600/90 bg-white px-2 py-1 text-[10px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                          >
                            Écarter (accord patient)…
                          </button>
                        </div>
                      ) : null}
                      {canManageSupply && selected && !lineLockedTrace && withdrawnDraft ? (
                        <p className="mt-1 rounded-md border border-border/80 bg-muted/25 px-1.5 py-1 text-[10px] leading-snug text-muted-foreground">
                          Ligne écartée — pastilles réservé / commandé désactivées pour cette ligne.
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
                  ) : showLineAndPublishEdits ? (
                    <div className="space-y-1.5 border-t border-border/55 px-2 py-2 sm:space-y-2 sm:px-3 sm:py-2.5">
                      <div className="flex flex-wrap items-end gap-1.5 sm:gap-2">
                        <div className="flex min-w-[9.5rem] flex-1 flex-col gap-0.5">
                          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                            Disponibilité
                          </span>
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
                              : isPrescriptionExtraProposed
                                ? "Qté proposée"
                                : "Qté"}
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
                      {canEditThisRow &&
                      f.availability_status !== "market_shortage" &&
                      f.availability_status !== "unavailable"
                        ? f.availability_status === "to_order" ? (
                          <p className="text-[9px] leading-snug text-teal-900/90">
                            <strong>À commander</strong> · quantité pour cette ligne :{" "}
                            <strong className="tabular-nums">{f.available_qty}</strong> (min. 1, max. {stockCeiling}).
                          </p>
                        ) : isAjoutOfficineLine ? (
                          <p className="text-[9px] leading-snug text-violet-900/90">
                            <span className="font-semibold text-violet-950">{proposedBadgeLabel} · </span>
                            stock minimum <strong>1</strong>, sans plafond lié à la quantité initialement
                            indiquée sur la ligne.
                          </p>
                        ) : isOrdonnancePharmacistLine ? (
                          <p className="text-[9px] leading-snug text-amber-900/90">
                            <span className="font-semibold text-amber-950">Ordonnance · </span>
                            qté dispo ≤ prescrite (
                            <strong className="tabular-nums">{draftRequestedQtyForInfer}</strong>
                            ). Indispo / rupture → qté dispo 0. Partiel si dispo &lt; prescrit.
                          </p>
                        ) : (
                          <p className="text-[9px] leading-snug text-muted-foreground">
                            Stock · max.&nbsp;
                            <strong className="text-foreground">{stockCeiling}</strong>
                            {" "}(≤ quantité demandée&nbsp;
                            <strong className="text-foreground">{row.requested_qty}</strong>
                            ).
                            {request.status === "confirmed" &&
                            row.is_selected_by_patient &&
                            (row.counter_outcome ?? "unset") !== "picked_up" &&
                            maxPreparationQtyForRow(row) < row.requested_qty ? (
                              <span className="text-muted-foreground">
                                {" "}
                                Au comptoir, plafonné à <strong className="text-foreground">{maxPreparationQtyForRow(row)}</strong> jusqu&apos;à
                                récupération.
                              </span>
                            ) : null}
                          </p>
                        )
                      : null}

                      {f.availability_status === "to_order" ? (
                        <label className="flex max-w-md flex-col gap-1 rounded-xl border-2 border-teal-400/70 bg-gradient-to-br from-teal-50/90 to-white p-2 shadow-sm ring-1 ring-teal-200/50">
                          <span className="text-[10px] font-bold uppercase tracking-wide text-teal-950">
                            Date de réception prévue (obligatoire pour le patient)
                          </span>
                          <input
                            type="date"
                            min={receptionDateMinYmd}
                            disabled={!canEditThisRow}
                            value={f.expected_availability_date}
                            onChange={(e) => setReceptionDateField(row.id, e.target.value)}
                            className="h-10 w-full rounded-lg border-2 border-teal-300/80 bg-white px-2 text-[13px] font-semibold tabular-nums shadow-inner disabled:opacity-60 sm:min-w-[11rem]"
                          />
                        </label>
                      ) : null}
                    </div>
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
                    </div>
                  )}

                  <div className="mx-2 mb-2 mt-1.5 rounded-xl border border-teal-200/55 border-l-[3px] border-l-teal-500/65 bg-gradient-to-br from-teal-50/50 via-cyan-50/25 to-transparent pl-2.5 pr-2 pb-1.5 pt-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:mx-3 sm:mt-2 sm:pl-3 sm:pb-2 sm:pt-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <button
                        type="button"
                        aria-expanded={isAltOpen(row.id)}
                        onClick={() => toggleAltOpen(row.id)}
                        className="flex min-h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl bg-white/90 px-2.5 py-2 text-left ring-1 ring-teal-200/40 shadow-sm backdrop-blur-[2px] transition hover:bg-white"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Layers className="size-4 shrink-0 text-teal-600" strokeWidth={2} aria-hidden />
                          <span className="truncate text-[11px] font-semibold text-teal-950">
                            <span className="text-teal-800/85">Alternatives </span>
                            <span className="font-mono tabular-nums text-teal-700">
                              {rowAlts.length}/3
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          className={clsx("size-[18px] shrink-0 text-teal-600 transition-transform duration-200", isAltOpen(row.id) && "rotate-180")}
                          aria-hidden
                        />
                      </button>
                      {canEditThisRow && rowAlts.length < 3 && altPickerOpenFor !== row.id ? (
                        <button
                          type="button"
                          disabled={altBusyRow === row.id}
                          title="Ajouter une alternative"
                          aria-label="Ajouter une alternative"
                          onClick={() => {
                            setAltPickerOpenFor(row.id);
                            setAltQuery("");
                            setAltHits([]);
                            setAltRowsOpen((prev) => ({ ...prev, [row.id]: true }));
                          }}
                          className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm ring-1 ring-teal-500/35 transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
                        </button>
                      ) : null}
                    </div>

                    {canEditThisRow && rowAlts.length < 3 && altPickerOpenFor === row.id ? (
                      <div className="mt-2 flex max-h-[min(52svh,20rem)] min-h-0 flex-col gap-2 overflow-hidden overscroll-y-contain rounded-xl border-2 border-teal-400/55 bg-white p-2.5 shadow-md ring-2 ring-teal-200/35">
                        <div className="flex shrink-0 items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-950">
                            <Search className="size-3.5 shrink-0 text-teal-600" aria-hidden />
                            Catalogue alternatives
                          </span>
                          <button
                            type="button"
                            className="rounded-md px-2 py-0.5 text-[10px] font-medium text-teal-800 hover:bg-teal-100/70"
                            onClick={resetAltPicker}
                          >
                            Fermer
                          </button>
                        </div>
                        <div className="relative shrink-0">
                          <Search
                            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-teal-600/90"
                            aria-hidden
                          />
                          <input
                            type="search"
                            value={altQuery}
                            onChange={(e) => setAltQuery(e.target.value)}
                            placeholder="Rechercher un produit (2 car. min.)"
                            className="h-10 w-full rounded-xl border-2 border-teal-400/50 bg-background py-2 pl-10 pr-3 text-[13px] shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/35"
                          />
                        </div>
                        {altVisibleHits.length > 0 ? (
                          <ul className="min-h-0 flex-1 touch-pan-y space-y-0.5 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card p-1 shadow-inner ring-1 ring-teal-200/35 [-webkit-overflow-scrolling:touch]">
                            {altVisibleHits.map((h) => (
                              <li key={h.id}>
                                <button
                                  type="button"
                                  disabled={altBusyRow === row.id}
                                  onClick={() => void insertAlternative(row, h)}
                                  className="flex w-full touch-manipulation items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition hover:bg-muted/65 active:bg-muted/80 disabled:opacity-50"
                                >
                                  <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-teal-200/60 bg-teal-50/50">
                                    {h.photo_url ? (
                                      <img src={h.photo_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-teal-600/70">
                                        <Package className="size-5" aria-hidden />
                                      </div>
                                    )}
                                  </div>
                                  <span className="min-w-0 flex-1">
                                    <span className="block font-semibold leading-tight text-foreground">{h.name}</span>
                                    {pphLabel(h.price_pph) ? (
                                      <span className="mt-0.5 block text-[10px] font-semibold text-primary">{pphLabel(h.price_pph)}</span>
                                    ) : null}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : altDebounced.length >= 2 ? (
                          <p className="mt-1 text-[10px] text-teal-800/80">Aucun résultat.</p>
                        ) : null}
                      </div>
                    ) : null}

                    {isAltOpen(row.id) ? (
                      <div className="mt-2 border-t border-teal-200/40 pt-2">
                        {rowAlts.length === 0 ? (
                          <p className="text-[10px] leading-snug text-teal-900/85">Pas encore d&apos;alternative sur cette ligne.</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {rowAlts.map((alt) => {
                              const altProd = one(alt.products);
                              const altName = altProd?.name ?? "Alternative";
                              const altPph = pphLabel(altProd?.price_pph);
                              const chosenAltId = row.patient_chosen_alternative_id ?? null;
                              const patientChoseHere =
                                request.status === "confirmed" &&
                                selected &&
                                chosenAltId != null &&
                                chosenAltId === alt.id;
                              const showIndicatif =
                                request.status === "confirmed" && selected && rowAlts.length > 0 && !patientChoseHere;
                              return (
                                <li
                                  key={alt.id}
                                  className={clsx(
                                    "flex items-center justify-between gap-2 rounded-xl border px-2 py-1.5 text-[10px] shadow-sm ring-1",
                                    patientChoseHere
                                      ? "border-emerald-300/70 bg-emerald-50/80 ring-emerald-200/50"
                                      : showIndicatif
                                        ? "border-teal-200/35 bg-white/50 opacity-70 ring-transparent"
                                        : "border-teal-200/50 bg-white/95 ring-teal-100/60"
                                  )}
                                >
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <div className="size-11 shrink-0 overflow-hidden rounded-lg border border-teal-200/50 bg-teal-50/50">
                                      {altProd?.photo_url ? (
                                        <img
                                        src={resolvePublicMediaUrl(altProd.photo_url) ?? altProd.photo_url}
                                        alt={altName}
                                        className="h-full w-full object-cover"
                                      />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-teal-600/70">
                                          <Layers className="size-5" aria-hidden />
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <p className="truncate font-semibold text-teal-950">{altName}</p>
                                        {patientChoseHere ||
                                        (row.patient_chosen_alternative_id != null &&
                                          row.patient_chosen_alternative_id === alt.id) ? (
                                          <span className="shrink-0 rounded-full bg-emerald-700 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-white">
                                            ALTERNATIVE
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-0.5 text-[10px] text-teal-800/85">
                                        #{alt.rank}
                                        {altPph ? <span className="text-teal-700"> · {altPph}</span> : null}
                                      </p>
                                      {canEditThisRow && showLineAndPublishEdits ? (
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                          <span className="text-[9px] font-bold uppercase tracking-wide text-teal-900/90">
                                            Qté
                                          </span>
                                          <div className="inline-flex h-7 items-center overflow-hidden rounded-lg border border-teal-300/70 bg-white shadow-sm">
                                            <button
                                              type="button"
                                              disabled={altBusyRow === alt.id}
                                              className="h-full w-6 border-r border-teal-200/80 text-xs font-bold text-teal-900 disabled:opacity-40"
                                              aria-label="Diminuer la quantité alternative"
                                              onClick={() => {
                                                if (isLocalAltId(alt.id)) {
                                                  const cur = clampAlternativeAvailableQty(Number(alt.available_qty ?? 1));
                                                  patchPendingAlternativeQty(alt.id, String(Math.max(1, cur - 1)));
                                                } else {
                                                  const cur = clampAlternativeAvailableQty(
                                                    Number(altQtyDrafts[alt.id] ?? alt.available_qty ?? row.requested_qty)
                                                  );
                                                  setAltQtyDrafts((d) => ({ ...d, [alt.id]: String(Math.max(1, cur - 1)) }));
                                                }
                                              }}
                                            >
                                              −
                                            </button>
                                            <input
                                              type="text"
                                              inputMode="numeric"
                                              disabled={altBusyRow === alt.id}
                                              className="h-full w-9 border-0 bg-transparent px-0.5 text-center text-[11px] font-bold tabular-nums text-teal-950 focus:outline-none"
                                              value={
                                                isLocalAltId(alt.id)
                                                  ? String(alt.available_qty ?? 1)
                                                  : altQtyDrafts[alt.id] ?? String(alt.available_qty ?? row.requested_qty)
                                              }
                                              onChange={(e) => {
                                                const v = e.target.value.replace(/[^\d]/g, "");
                                                if (isLocalAltId(alt.id)) {
                                                  patchPendingAlternativeQty(alt.id, v);
                                                } else {
                                                  setAltQtyDrafts((d) => ({ ...d, [alt.id]: v }));
                                                }
                                              }}
                                              onBlur={() => {
                                                if (isLocalAltId(alt.id)) {
                                                  patchPendingAlternativeQty(
                                                    alt.id,
                                                    String(clampAlternativeAvailableQty(Number(alt.available_qty ?? 1)))
                                                  );
                                                  return;
                                                }
                                                const n = clampAlternativeAvailableQty(
                                                  Number(altQtyDrafts[alt.id] ?? alt.available_qty ?? row.requested_qty)
                                                );
                                                setAltQtyDrafts((d) => ({
                                                  ...d,
                                                  [alt.id]: String(Math.max(1, n)),
                                                }));
                                              }}
                                            />
                                            <button
                                              type="button"
                                              disabled={altBusyRow === alt.id}
                                              className="h-full w-6 border-l border-teal-200/80 text-xs font-bold text-teal-900 disabled:opacity-40"
                                              aria-label="Augmenter la quantité alternative"
                                              onClick={() => {
                                                if (isLocalAltId(alt.id)) {
                                                  const cur = clampAlternativeAvailableQty(Number(alt.available_qty ?? 1));
                                                  patchPendingAlternativeQty(alt.id, String(clampAlternativeAvailableQty(cur + 1)));
                                                } else {
                                                  const cur = clampAlternativeAvailableQty(
                                                    Number(altQtyDrafts[alt.id] ?? alt.available_qty ?? row.requested_qty)
                                                  );
                                                  setAltQtyDrafts((d) => ({
                                                    ...d,
                                                    [alt.id]: String(clampAlternativeAvailableQty(cur + 1)),
                                                  }));
                                                }
                                              }}
                                            >
                                              +
                                            </button>
                                          </div>
                                          <span className="text-[8px] text-teal-800/80 tabular-nums">
                                            max 10
                                          </span>
                                        </div>
                                      ) : (
                                        <p className="mt-0.5 text-[10px] text-teal-800/85">
                                          Qté <strong className="tabular-nums">{alt.available_qty ?? row.requested_qty}</strong>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {canEditThisRow ? (
                                    <button
                                      type="button"
                                      disabled={altBusyRow === alt.id}
                                      onClick={() => void deleteAlternativeRow(alt.id, row.id)}
                                      className="shrink-0 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2 py-1 text-[9px] font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                                    >
                                      Retirer
                                    </button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>

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
                            <select
                              value={counterSelectKeyNormalized(
                                row,
                                draft[row.id] ?? buildItemDraftFromRow(row, request.status, request.request_type)
                              )}
                              disabled={outcomeSelectDisabled}
                              onChange={(e) => {
                                const v = e.target.value as "unset" | "picked_up";
                                void saveCounterOutcome(row.id, v, null, null);
                              }}
                              className={`h-7 w-full rounded border border-input bg-background px-1.5 text-[11px] ${
                                request.status === "completed" ? "cursor-not-allowed opacity-60" : ""
                              }`}
                            >
                              <option value="unset">En attente</option>
                              <option value="picked_up">Récupéré</option>
                            </select>
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
              </div>
            ))}
          </div>
              </>
              ) : null}
            </>
          ))}

          {showConsultationProductsPane && showLineAndPublishEdits ? (
            <section className="mt-2 flex min-h-0 flex-col rounded-xl border border-violet-300/70 bg-gradient-to-br from-violet-50/80 via-fuchsia-50/35 to-white px-2 py-1.5 shadow-sm ring-1 ring-violet-300/35 sm:px-2.5 sm:py-2">
              {isConsultation ? (
                <div className="rounded-lg bg-white/90 px-2 py-2 ring-1 ring-violet-200/55 sm:px-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-950">
                    Saisir les produits proposés
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
                    const next = !propOpen;
                    setPropOpen(next);
                    setError("");
                    if (next) {
                      resetPropForm();
                      if (request?.request_type === "prescription") {
                        setPropReason(PRESCRIPTION_ADDITIONAL_PROPOSED_REASON);
                      }
                    }
                  }}
                  className="flex w-full min-h-11 items-start justify-between gap-2 rounded-lg bg-white/90 px-2 py-2 text-left ring-1 ring-violet-200/55 shadow-sm transition hover:bg-violet-50/60 sm:min-h-0 sm:items-center sm:px-2.5"
                >
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-violet-950">
                      {isPrescription ? "Produits proposés" : workflowCopy.pharmacistProposeSectionTitle}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-violet-900/85 sm:text-[11px]">
                      {isPrescription
                        ? "En complément des produits saisis depuis l’ordonnance."
                        : workflowCopy.pharmacistProposeSectionSubtitle}
                    </span>
                  </span>
                  <ChevronDown
                    className={clsx("mx-px size-6 shrink-0 text-violet-700 transition-transform sm:size-5", propOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
              )}
              {propOpen || isConsultation ? (
                <div className="mt-2 flex max-h-[min(52svh,22rem)] min-h-0 flex-col gap-2 overflow-hidden overscroll-y-contain">
                  <label className="block shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Motif
                    <textarea
                      rows={2}
                      value={propReason}
                      onChange={(e) => setPropReason(e.target.value.slice(0, 1000))}
                      placeholder="Motif visible client"
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="block shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
                        onClick={() => setPropQty((q) => String(Math.min(PHARMACIST_VALIDATED_SUPPLY_EDIT_MAX, (parseInt(q, 10) || 1) + 1)))}
                        className="h-full w-7 border-l border-input text-xs font-bold text-muted-foreground"
                        aria-label="Augmenter la quantité proposée"
                      >
                        +
                      </button>
                    </div>
                  </label>
                  <div className="relative shrink-0">
                    <Search
                      className="pointer-events-none absolute left-3 top-1/2 size-[1.125rem] -translate-y-1/2 text-violet-600"
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={propQuery}
                      onChange={(e) => setPropQuery(e.target.value)}
                      placeholder="Rechercher dans le catalogue (2 caractères min.)"
                      className="h-11 w-full rounded-xl border-2 border-violet-400/70 bg-white py-2 pl-10 pr-3 text-[13px] shadow-sm ring-2 ring-violet-200/50 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/35"
                    />
                  </div>
                  {propVisibleHits.length > 0 ? (
                    <ul className="min-h-0 flex-1 touch-pan-y space-y-0.5 overflow-y-auto overscroll-contain rounded-md border border-border/60 bg-muted/20 p-1 [-webkit-overflow-scrolling:touch]">
                      {propVisibleHits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            disabled={propBusy}
                            onClick={() =>
                              void insertPharmacistProposedLine(h, {
                                lineKind: isPrescription ? "proposed" : undefined,
                              })
                            }
                            className="flex w-full touch-manipulation items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-card disabled:opacity-50"
                          >
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-lg border border-violet-200/60 bg-violet-50/50">
                              {h.photo_url ? (
                                <img src={h.photo_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-violet-500/80">
                                  <Package className="size-5" aria-hidden />
                                </div>
                              )}
                            </div>
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium text-foreground">{h.name}</span>
                              {pphLabel(h.price_pph) ? (
                                <span className="mt-0.5 block text-[11px] font-medium text-teal-800">{pphLabel(h.price_pph)}</span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : propDebounced.length >= 2 ? (
                    <p className="text-[11px] text-muted-foreground">Aucun résultat.</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {showConsultationProductsPane && respondedFrozenView ? (
            <section className="mt-3 space-y-2 rounded-xl border border-amber-200/85 bg-amber-50/50 p-2.5 shadow-sm sm:mt-4 sm:p-3">
              <button
                type="button"
                onClick={() => {
                  resetDraftFromRows();
                  setPendingProposalRows([]);
                  setPendingAlternatives([]);
                  setRespondedEditMode(true);
                  setError("");
                  window.setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }, 0);
                }}
                className="inline-flex h-10 min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-md border border-amber-400/90 bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-50/90 sm:min-h-10 sm:text-sm"
              >
                <Pencil className="size-[15px] shrink-0" strokeWidth={2} aria-hidden />
                Modifier la réponse
              </button>
              <p className="text-center text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                Lecture seule pour le patient jusqu’à modification. L’annulation de la demande reste disponible ci-dessous.
              </p>
            </section>
          ) : null}

          {showConsultationProductsPane && showLineAndPublishEdits ? (
            <section className="mt-3 space-y-2 sm:mt-4">
              {canEditResponse ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError("");
                    setPublishConfirmOpen(true);
                  }}
                  className={clsx(
                    "inline-flex min-h-[3.25rem] w-full items-center justify-center rounded-2xl px-6 py-3 text-base font-bold tracking-tight text-white shadow-lg transition hover:shadow-xl disabled:opacity-50 sm:min-h-[3.5rem] sm:text-[1.05rem]",
                    isConsultation
                      ? "bg-violet-700 ring-2 ring-violet-900/15 hover:bg-violet-800"
                      : "bg-emerald-700 ring-2 ring-emerald-900/15 hover:bg-emerald-800"
                  )}
                >
                  {isConsultation ? "Publier les produits proposés au patient…" : "Envoyer la réponse au patient…"}
                </button>
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

          {request.status === "treated" && !canCompleteCounter && items.length > 0 ? (
            <p className="mt-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-2.5 py-2 text-[11px] leading-snug text-amber-950">
              {counterClosurePendingTracked > 0
                ? "Pour clôturer le dossier, marquez « Récupéré » sur chaque ligne retenue encore au comptoir — ou écartez les produits dont le client n’a plus besoin."
                : "La clôture s’active lorsque toutes les lignes retenues actives sont marquées récupérées au comptoir."}
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

          <section className="mt-3 rounded-lg border border-border/60 bg-muted/15 p-2 shadow-sm">
            <button
              type="button"
              onClick={() => {
                const next = !historyOpen;
                setHistoryOpen(next);
                if (next && historyRows.length === 0 && !historyBusy) {
                  void loadHistory();
                }
              }}
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-border/80 bg-background px-3 text-xs font-semibold text-foreground hover:bg-muted/50 sm:w-auto"
            >
              {historyOpen ? "Masquer l'historique" : "Voir l'historique du dossier"}
            </button>
            {historyOpen ? (
              <div className="mt-2 space-y-1.5">
                {historyBusy ? (
                  <p className="text-xs text-muted-foreground">Chargement…</p>
                ) : historyRows.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Aucun événement.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {historyRows.map((h) => {
                      const detailParas = pharmacistDossierHistoryDetailParagraphsFr(h.reason);
                      return (
                      <li key={h.id} className="rounded-md border border-border/50 bg-background/80 px-2 py-1.5 text-xs">
                        <p className="font-medium text-foreground">
                          {requestHistoryPharmacistHeadline(h.old_status, h.new_status)}
                        </p>
                        {detailParas.length > 0 ? (
                          <div className="mt-0.5 space-y-0.5">
                            {detailParas.map((para, i) => (
                              <p key={i} className="break-words text-[11px] leading-snug text-muted-foreground">
                                {para}
                              </p>
                            ))}
                          </div>
                        ) : h.reason && h.reason.trim().length > 0 && !h.reason.startsWith("audit_v1:") ? (
                          <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
                            {pharmacistHardStopMotifSummaryFr(h.reason) ?? h.reason}
                          </p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                          <span>
                            Par <strong className="font-medium text-foreground">{historyActorLabel("pharmacien", h.reason)}</strong>
                          </span>
                          <span aria-hidden>·</span>
                          <time dateTime={h.created_at} className="tabular-nums">
                            {formatDateTimeShort24hFr(h.created_at)}
                          </time>
                        </p>
                      </li>
                    ); })}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
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
                allowEdit={canEditThisRow && showLineAndPublishEdits}
                showPersistButton={false}
                persistBusy={false}
              />
            );
          })()
        : null}
      {publishConfirmOpen ? (
        <div
          className="fixed inset-0 z-[10060] flex items-end justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[1px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setPublishConfirmOpen(false);
          }}
        >
          <div
            className="flex max-h-[min(92vh,36rem)] w-full max-w-lg flex-col rounded-2xl border border-emerald-200/90 bg-card p-4 shadow-2xl ring-1 ring-emerald-900/10 sm:max-w-xl sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="publish-confirm-title" className="shrink-0 text-center text-sm font-bold text-emerald-950">
              Confirmer l&apos;envoi au patient
            </h2>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
              <div className="space-y-4 text-[11px]">
                {publishConfirmGroups.ready.length > 0 ? (
                  <section>
                    <h3 className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-emerald-900/90">
                      Disponible ou partiellement disponible
                    </h3>
                    <ul className="space-y-2.5">
                      {publishConfirmGroups.ready.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {publishConfirmGroups.order.length > 0 ? (
                  <section>
                    <h3 className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-amber-900/90">
                      À commander
                    </h3>
                    <ul className="space-y-2.5">
                      {publishConfirmGroups.order.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
                        />
                      ))}
                    </ul>
                  </section>
                ) : null}
                {publishConfirmGroups.blocked.length > 0 ? (
                  <section>
                    <h3 className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-700">
                      Indisponible, rupture ou indisponibilité marché
                    </h3>
                    <ul className="space-y-2.5">
                      {publishConfirmGroups.blocked.map((meta) => (
                        <PublishConfirmLineLi
                          key={meta.r.id}
                          meta={meta}
                          altQtyDrafts={altQtyDrafts}
                          proposedBadgeLabel={proposedBadgeLabel}
                          ordonnanceBadgeLabel={ordonnanceLineBadge}
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
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50 sm:w-auto"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPublishConfirmOpen(false);
                  void publishResponse();
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50 sm:w-auto"
              >
                {busy ? "Publication…" : "Confirmer et envoyer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {canManageResponded && respondedEditMode ? (
        <div className="fixed inset-x-0 bottom-0 z-[10040] border-t border-amber-400/80 bg-background/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-6px_28px_rgba(15,23,42,0.12)] backdrop-blur-md sm:px-4">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                resetDraftFromRows();
                setRespondedEditMode(false);
                setPendingProposalRows([]);
                setPendingAlternatives([]);
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
                const diffs = diffRespondedSnapshots(b, displayRows, draft, altQtyDrafts, pendingProposalRows, pendingAlternatives);
                setRespondedSaveDiffLines(diffs);
                setRespondedSaveConfirmOpen(true);
              }}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-amber-600 bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-amber-700 disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
            >
              Enregistrer
            </button>
          </div>
        </div>
      ) : null}
      {respondedSaveConfirmOpen ? (
        <div
          className="fixed inset-0 z-[10058] flex items-end justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[1px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="responded-save-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setRespondedSaveConfirmOpen(false);
              setRespondedSaveDiffLines([]);
            }
          }}
        >
          <div
            className="flex max-h-[min(88vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-amber-200/90 bg-card p-4 shadow-2xl ring-1 ring-amber-900/10"
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
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50 sm:w-auto"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy || respondedSaveDiffLines.length === 0}
                onClick={() => void saveRespondedAdjustments()}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-amber-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50 sm:w-auto"
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {supplySaveConfirmOpen ? (
        <div
          className="fixed inset-0 z-[10059] flex items-end justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-[1px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="supply-save-confirm-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) {
              setSupplySaveConfirmOpen(false);
              setSupplySaveConfirmLines([]);
            }
          }}
        >
          <div
            className="flex max-h-[min(88vh,28rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-cyan-200/90 bg-card p-4 shadow-2xl ring-1 ring-cyan-900/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="supply-save-confirm-title" className="text-center text-sm font-bold text-cyan-950">
              Confirmer l’enregistrement
            </h2>
            <p className="mt-2 text-center text-[11px] leading-snug text-muted-foreground">
              Résumé des changements appliqués en base et visibles côté patient — vérifiez avant de valider.
            </p>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-lg border border-cyan-200/60 bg-cyan-50/40 px-2.5 py-2">
              {supplySaveConfirmLines.length === 0 ? (
                <p className="text-center text-[11px] font-medium text-cyan-900/90">Aucun détail à afficher.</p>
              ) : (
                <ul className="space-y-1.5 text-[11px] leading-snug text-cyan-950">
                  {supplySaveConfirmLines.map((line, i) => (
                    <li
                      key={`${i}-${line.slice(0, 24)}`}
                      className="flex gap-2 rounded-md border border-cyan-200/50 bg-white/90 px-2 py-1.5"
                    >
                      <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-cyan-500" aria-hidden />
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
                }}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted/50 disabled:opacity-50 sm:w-auto"
              >
                Retour
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void executeConfirmedSupplySave()}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-cyan-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-50 sm:w-auto"
              >
                {busy ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showBottomActionSticky || showSupplyStatsFooter || showSupplyDirtyBar ? (
        <div className="fixed inset-x-0 bottom-0 z-[10050] flex flex-col border-t border-cyan-500/25 bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_28px_rgba(15,23,42,0.12)] backdrop-blur-md">
          {showDeclareTreatedSticky ? (
            <div className="border-b border-cyan-500/20 px-3 py-2.5">
              <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-center text-[11px] leading-snug text-muted-foreground sm:flex-1 sm:text-left">
                  Toutes les lignes retenues sont à jour (réservé / commandé selon le cas). Déclarez la demande traitée
                  pour activer le suivi au comptoir côté patient.
                </p>
                <button
                  type="button"
                  disabled={declareTreatedBusy}
                  onClick={() => void runDeclareRequestTreated()}
                  className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-cyan-600 px-5 text-sm font-bold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
                >
                  {declareTreatedBusy ? "En cours…" : "Déclarer la demande traitée"}
                </button>
              </div>
            </div>
          ) : null}
          {showCloseCounterSticky ? (
            <div className="border-b border-cyan-500/20 px-3 py-2.5">
              <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="text-center text-[11px] leading-snug text-muted-foreground sm:flex-1 sm:text-left">
                  Toutes les lignes retenues sont récupérées au comptoir. Vous pouvez clôturer le dossier.
                </p>
                <button
                  type="button"
                  disabled={completeBusy}
                  onClick={() => setCloseConfirmOpen(true)}
                  className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-bold text-background shadow-md transition hover:opacity-90 disabled:opacity-50 sm:w-auto sm:min-w-[200px]"
                >
                  {completeBusy ? "Clôture…" : "Clôturer le dossier"}
                </button>
              </div>
            </div>
          ) : null}
          {showSupplyStatsFooter ? (
            <div className="flex justify-center border-b border-cyan-500/15 px-3 py-2">
              <div className="flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-foreground">
                <span className="font-semibold tabular-nums text-muted-foreground">
                  {supplyFooterTotals.count} produit{supplyFooterTotals.count > 1 ? "s" : ""}
                </span>
                <span className="font-bold tabular-nums text-cyan-950">
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
            </div>
          ) : null}
          {showSupplyDirtyBar ? (
            <div className="border-t border-sky-500/35 bg-background/98 px-3 py-2.5 sm:px-4">
              <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={busy || supplyConfirmBusy}
                  onClick={() => cancelConfirmedSupplyEdits()}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-sky-400/90 bg-white px-4 py-2.5 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-50/90 disabled:opacity-50 sm:order-1 sm:w-auto sm:min-w-[9rem]"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy || supplyConfirmBusy}
                  onClick={() => startSaveConfirmedAdjustments()}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-sky-800 bg-sky-950 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-sky-900 disabled:opacity-50 sm:w-auto sm:min-w-[11rem]"
                >
                  {busy ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <PharmacistSupplyAmendmentConfirmModal
        open={supplyConfirmOpen}
        onClose={() => {
          if (supplyConfirmBusy) return;
          setSupplyConfirmOpen(false);
          setSupplyConfirmPending(null);
        }}
        heading={
          supplyConfirmPending?.kind === "unlock_modify"
            ? "Autoriser la modification de la ligne"
            : supplyConfirmPending?.kind === "withdraw_line"
              ? "Écarter la ligne après validation"
              : supplyConfirmPending?.kind === "remove_proposed_line"
                ? "Retirer la proposition officine"
                : supplyConfirmPending?.kind === "add_line"
                  ? "Ajouter un produit après validation"
                  : "Confirmation"
        }
        intro={
          supplyConfirmPending?.kind === "unlock_modify"
            ? "Choisissez le canal : la modification s’ouvre tout de suite (précision optionnelle possible sur la ligne)."
            : supplyConfirmPending?.kind === "withdraw_line"
              ? "L’écart s’applique en brouillon dès le choix du canal ; journalisation à l’enregistrement du dossier."
              : supplyConfirmPending?.kind === "remove_proposed_line"
                ? "Le retrait est journalisé pour le patient avec le canal d’accord."
                : supplyConfirmPending?.kind === "add_line"
                  ? "Choisissez le canal d’accord : l’ajout est créé en brouillon tout de suite, journalisé avec « Enregistrer les modifications »."
                  : "Indiquez comment le patient a donné son accord."
        }
        blocks={supplyConfirmBlocks}
        confirmLabel={
          supplyConfirmPending?.kind === "add_line"
            ? "Valider (brouillon)"
            : supplyConfirmPending?.kind === "remove_proposed_line"
              ? "Enregistrer et retirer"
              : "Valider"
        }
        busy={supplyConfirmBusy}
        onConfirm={(fills) => void applySupplyModalConfirm(fills)}
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
          }}
          onClearProduct={() => {
            setOrdonnanceQuickAddPick(null);
            setOrdonnanceQuickAlternatives([]);
            setOrdonnanceAltQuery("");
          }}
          alternatives={ordonnanceQuickAlternatives}
          altQuery={ordonnanceAltQuery}
          onAltQueryChange={setOrdonnanceAltQuery}
          altHits={ordonnanceAltHits.filter(
            (h) =>
              h.id !== ordonnanceQuickAddPick?.id &&
              !ordonnanceQuickAlternatives.some((a) => a.id === h.id)
          )}
          onAddAlternative={(h) => {
            if (ordonnanceQuickAlternatives.length >= 3) return;
            if (h.id === ordonnanceQuickAddPick?.id) return;
            setOrdonnanceQuickAlternatives((prev) => [...prev, h as ProductCatalogHit]);
            setOrdonnanceAltQuery("");
            setOrdonnanceAltHits([]);
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
      {usesLineWorkflow && sessionUserId && !isConsultation ? (
        <>
          <RequestConversationFabDock
            hasUnread={conversationUnread}
            onOpen={() => setConversationOpen(true)}
            tone="pharmacien"
          />
          <RequestConversationPanel
            requestId={id}
            viewerRole="pharmacien"
            currentUserId={sessionUserId}
            open={conversationOpen}
            onClose={() => setConversationOpen(false)}
            onMarkedRead={() => setConversationUnread(false)}
          />
        </>
      ) : null}
    </PageShell>
  );
}
