"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  History,
  Layers,
  Calendar,
  MessageCircle,
  Package,
  Pencil,
  ShoppingCart,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { cn } from "@/lib/utils";
import { Z_STICKY_FOOTER } from "@/lib/ui-z-index";
import {
  formatDateShortFr,
  formatDateTimeShort24hFr,
  formatPlannedVisitFr,
  formatTime24hFr,
  patientArchiveLastPlannedVisitFootnoteFr,
  patientPlannedVisitPassageLineFr,
} from "@/lib/datetime-fr";
import {
  RequestExitConfirmModalFr,
  type RequestExitModalMode,
} from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import {
  availabilityStatusFr,
  pharmacistProposedProductBadgeFr,
  requestItemLineSourceFr,
  requestStatusFr,
} from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import {
  bucketPatientRespondedLines,
  PATIENT_RESPONDED_BUCKET_ORDER,
} from "@/lib/patient-responded-line-buckets";
import { PatientRespondedBucketSection } from "@/components/requests/product/patient-responded-bucket-section";
import {
  PlatformStickyFooter,
  PlatformStickyFooterSummaryRow,
} from "@/components/layout/platform-sticky-footer";
import { stickyFooterPadClass, type StickyFooterPadTier } from "@/lib/platform-sticky-footer";
import {
  bucketPatientValidatedLinesThreeWays,
  type PatientLineLike,
  validatedBranchUnitPriceMad,
  validatedBranchPhotoPath,
  validatedProductLabel,
  patientDisplayQtyForLine,
} from "@/lib/patient-confirmed-line-buckets";
import { formatPriceDh } from "@/lib/product-price";
import { usePharmacyPricingForPatient } from "@/lib/pharmacy-pricing";
import { catalogHitToPricingInput, productEmbedToPricingInput } from "@/lib/pharmacy-pricing/product-embed";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing";
import {
  PriceDhInline,
  ProductRequestCatalogHitRow,
  ProductRequestLineMessageIconButton,
  ProductRequestLineQtyInline,
  ProductRequestLinePrices,
  ProductRequestSearchExplorerRow,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { PatientProductRequestDossierHeader } from "@/components/requests/product/patient-product-request-dossier-header";
import { PatientProductRequestCompactLine } from "@/components/requests/product/patient-product-request-compact-line";
import { PatientPharmaUpdateBanner } from "@/components/requests/product/patient-pharma-update-banner";
import { RespondedPatientLineChooser } from "@/components/requests/product/patient-responded-line-chooser";
import {
  PatientPharmacyQuickContact,
  type PatientPharmacyContactInfo,
} from "@/components/requests/product/patient-pharmacy-quick-contact";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import {
  clearPatientDemandeCatalogueReturnEdit,
  clearPatientDemandeProduitsDraft,
  draftLineToResubmitLine,
  draftLineUnitPrice,
  peekPatientDemandeCatalogueReturnEdit,
  readPatientDemandeProduitsDraft,
  writePatientDemandeProduitsDraft,
  writePatientDemandeProduitsNote,
  type PatientDemandeProduitsDraftLine,
} from "@/lib/patient-demande-produits-draft";
import { buildPatientDemandeProduitsDraftFromArchiveRequest } from "@/lib/patient-expired-request-draft";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import {
  findTerminalStatusHistoryEntry,
  patientAbandonedDossierStatusHintFr,
  patientAbandonedDossierStatusHintShortFr,
  patientCancelledDossierStatusHintFr,
  patientCancelledDossierStatusHintShortFr,
  patientClosedDossierStatusHintFr,
  patientClosedDossierStatusHintShortFr,
  patientExpiredDossierStatusHintFr,
  patientExpiredDossierStatusHintShortFr,
  isPatientProductClosedArchiveStatus,
} from "@/lib/patient-archive-outcome-fr";
import {
  bucketPatientClosedArchiveLines,
  PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER,
  patientClosedArchiveBucketTitleFr,
  patientClosedArchiveClosureLabelFr,
} from "@/lib/patient-closed-archive-line-buckets";
import {
  PRODUCT_CATALOG_SEARCH_LIMIT,
  PRODUCT_CATALOG_SEARCH_MIN_CHARS,
  filterCatalogHitsExcludingProductIds,
  productIdsFromLineProductIds,
  productNameOrLaboratoryIlikeOr,
  sanitizeProductSearchQuery,
} from "@/lib/product-catalog-search";
import { supabase } from "@/lib/supabase";
import { one } from "@/lib/embed";
import {
  buildPatientLineTimelineFr,
  type PatientLineTimelineBlockFr,
} from "@/lib/build-patient-line-timeline-fr";
import { patientLatestSupplyAmendmentNoticeFr } from "@/lib/patient-pharma-change-notice-fr";
import { LineHistoryModalFr } from "@/components/requests/line-history-modal-fr";
import { isPatientProductArchiveStatus } from "@/components/requests/patient-request-outcome-banner";
import {
  PatientPrescriptionEditablePanel,
  type PatientPrescriptionPanelHandle,
} from "@/components/requests/prescription/patient-prescription-editable-panel";
import {
  patientPrescriptionChoiceDetail,
  patientPrescriptionLineBadge,
} from "@/lib/prescription-patient-labels";
import {
  isPrescriptionAdditionalProposedLine,
  PRESCRIPTION_ADDITIONAL_PROPOSED_REASON,
} from "@/lib/prescription-pharmacist-lines";
import { inferArchiveSnapshotStatus } from "@/lib/request-archive-snapshot-status";
import { patientLineProposedBadgeLabel } from "@/lib/patient-line-proposed-badge";
import type { PrescriptionPagePaths } from "@/lib/prescription-media";
import { PrescriptionScanCollapsible } from "@/components/requests/prescription/prescription-scan-collapsible";
import { getRequestKindWorkflowCopy } from "@/lib/request-kinds/workflow-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindAccent } from "@/lib/request-kinds/types";
import { productRequestPublicTheme as productRequestTheme } from "@/lib/request-kinds/product-request-public-theme";
import { PatientProductPhotoPreviewModal } from "@/components/requests/patient-product-photo-preview-modal";
import { PlannedVisitTimeInput } from "@/components/requests/planned-visit-time-input";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import {
  lineConversationStripButtonClass,
  lineConversationStripLabel,
  lineConversationVisual,
} from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { PatientLineNotesIconButton } from "@/components/requests/product/patient-line-notes-icon-button";
import {
  buildPatientValidatedLineLabelsFr,
  validatedLineLabelChipClass,
  validatedOriginLabelFr,
} from "@/lib/patient-validated-line-labels-fr";

type ProdBrief = {
  name: string;
  product_type?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  photo_url?: string | null;
};

export type ActionItemAltRow = {
  id: string;
  rank: number;
  product_id: string;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  expected_availability_date: string | null;
  products: ProdBrief | ProdBrief[] | null;
};

export type ActionItemRow = {
  id: string;
  product_id: string;
  requested_qty: number;
  selected_qty: number | null;
  is_selected_by_patient: boolean;
  availability_status: string | null;
  available_qty: number | null;
  unit_price: number | null;
  pharmacist_comment: string | null;
  /** Q11 note patient par ligne */
  client_comment?: string | null;
  /** Q20 */
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  counter_outcome: string;
  counter_cancel_reason?: string | null;
  counter_cancel_detail?: string | null;
  expected_availability_date: string | null;
  post_confirm_fulfillment?: string | null;
  withdrawn_after_confirm?: boolean | null;
  products: ProdBrief | ProdBrief[] | null;
  patient_chosen_alternative_id?: string | null;
  request_item_alternatives?: ActionItemAltRow | ActionItemAltRow[] | null;
};

/** null = rien pour cette ligne ; "principal" ; sinon id alternative */
export type LineBranch = null | "principal" | string;

export type LineSelState = {
  branch: LineBranch;
  /** Qté de la branche retenue (case cochée). */
  qty: number;
  /** Qté par onglet (principal | id alternative) — conservée à la navigation. */
  browseQty: Record<string, number>;
};

export function lineBranchKey(branch: Exclude<LineBranch, null>): string {
  return branch === "principal" ? "principal" : branch;
}

export function lineSelQtyForBranch(
  st: LineSelState,
  branch: Exclude<LineBranch, null>,
  cap: number
): number {
  const key = lineBranchKey(branch);
  const stored = st.browseQty[key];
  if (stored != null) return Math.min(Math.max(1, stored), cap);
  if (st.branch === branch) return Math.min(Math.max(1, st.qty), cap);
  return cap > 0 ? cap : 1;
}

function emptyLineSelState(): LineSelState {
  return { branch: null, qty: 1, browseQty: {} };
}

function normalizeAlternatives(raw: ActionItemAltRow | ActionItemAltRow[] | null | undefined): ActionItemAltRow[] {
  if (!raw) return [];
  return Array.isArray(raw) ? [...raw].sort((a, b) => a.rank - b.rank) : [raw];
}

function maxQtyPrincipal(row: ActionItemRow): number {
  return patientMaxQtyPrincipal(row);
}

function maxQtyAlt(row: ActionItemRow, alt: ActionItemAltRow): number {
  return patientMaxQtyAlternative(row, alt);
}

function maxQtyForBranch(row: ActionItemRow, branch: LineBranch, alts: ActionItemAltRow[]): number {
  if (branch === null) return 0;
  if (branch === "principal") return maxQtyPrincipal(row);
  const alt = alts.find((a) => a.id === branch);
  if (!alt) return 0;
  return maxQtyAlt(row, alt);
}

export type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";

function monetaryTotalsForRetainedLines(
  rows: ActionItemRow[],
  requestStatus?: string | null,
  pricingConfig?: PharmacyPricingConfig | null
): { count: number; sumKnown: number; missingPrice: boolean } {
  let sumKnown = 0;
  let missingPrice = false;
  let count = 0;
  for (const row of rows) {
    if (!row.is_selected_by_patient || row.withdrawn_after_confirm) continue;
    count += 1;
    const unit = validatedBranchUnitPriceMad(row, pricingConfig, row.product_id);
    const qty = patientDisplayQtyForLine(row, requestStatus);
    if (unit == null) missingPrice = true;
    else sumKnown += unit * qty;
  }
  return { count, sumKnown, missingPrice };
}

/** Libellé court sur une ligne (mobile). */
function compactTotalMadLabel(t: { sumKnown: number; missingPrice: boolean; empty: boolean }): string {
  if (t.empty) return "—";
  if (t.missingPrice && t.sumKnown === 0) return "Total —";
  if (t.missingPrice) return `Total · ${t.sumKnown.toFixed(2)} MAD · partiel`;
  return `Total · ${t.sumKnown.toFixed(2)} MAD`;
}

/** Vignette validée — même gabarit que demande répondue (~62px). */
const VALIDATED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

function validatedLineShellClass(
  tier: "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation",
  withdrawnGrey: boolean
): string {
  if (withdrawnGrey) {
    return "border-slate-200/75 bg-slate-50/75 saturate-[0.65] opacity-[0.72]";
  }
  if (tier === "dispo_officine") return "border-sky-300/85 bg-white ring-1 ring-sky-200/55";
  if (tier === "commande") return "border-teal-300/85 bg-white ring-1 ring-teal-200/55";
  if (tier === "retire_apres_validation") return "border-red-200/85 bg-red-50/30";
  return "border-slate-200/80 bg-white";
}

/** Cartes condensées : produits validés après confirmation (alignées répondue / envoyée). */
export function PatientValidatedCompactLineCard({
  row,
  tier,
  onOpenHistory,
  requestStatusForCard = null,
  archiveClosureLabel = null,
  onPhotoPreview,
  pharmacistProposedBadgeLabel = pharmacistProposedProductBadgeFr,
  requestType = "product_request",
  supplyAmendmentBundles = [],
  pricingConfig = null,
}: {
  row: ActionItemRow;
  tier: "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation";
  pricingConfig?: PharmacyPricingConfig | null;
  onOpenHistory: () => void;
  requestStatusForCard?: string | null;
  archiveClosureLabel?: string | null;
  onPhotoPreview?: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel?: string;
  requestType?: string;
  supplyAmendmentBundles?: { amendments: unknown }[];
}) {
  const validatedName = validatedProductLabel(row);
  const displayQty = patientDisplayQtyForLine(row, requestStatusForCard);
  const unitMad = validatedBranchUnitPriceMad(row, pricingConfig, row.product_id);
  const lineTotalMad = unitMad != null ? unitMad * displayQty : null;
  const thumbUrl = resolvePublicMediaUrl(validatedBranchPhotoPath(row));

  const withdrawnGrey = tier === "retire_apres_validation";
  const prescriptionBadge =
    requestType === "prescription"
      ? patientPrescriptionLineBadge(requestType, row, supplyAmendmentBundles)
      : null;
  const originLabel = validatedOriginLabelFr({
    row,
    requestType,
    pharmacistProposedBadgeLabel,
    prescriptionBadge,
  });
  const lineLabels = buildPatientValidatedLineLabelsFr({
    row,
    originLabel,
    supplyAmendmentBundles,
    archiveClosureLabel,
    treatedLineLabels: requestStatusForCard === "treated",
  });
  const thumbInner = thumbUrl ? (
    onPhotoPreview ? (
      <button
        type="button"
        className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", productRequestTheme.photoRing)}
        onClick={() => onPhotoPreview(thumbUrl, validatedName)}
        aria-label={`Agrandir la photo · ${validatedName}`}
      >
        <img src={thumbUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
      </button>
    ) : (
      <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
    )
  ) : (
    <span className="flex h-full w-full items-center justify-center">
      <Package className="size-5 text-muted-foreground" aria-hidden />
    </span>
  );

  return (
    <li
      className={cn(
        "w-full min-w-0 overflow-visible rounded-lg border transition",
        validatedLineShellClass(tier, withdrawnGrey)
      )}
    >
      <div className="flex items-stretch gap-2.5 p-2.5">
        <div className={cn(VALIDATED_LINE_THUMB, "shrink-0 self-center", withdrawnGrey && "opacity-95")}>
          {thumbInner}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 py-0.5">
          <div className="flex min-w-0 items-start gap-1">
            <p
              className={cn(
                "min-w-0 flex-1 truncate pb-px text-[13px] font-semibold leading-snug",
                withdrawnGrey && "text-muted-foreground line-through decoration-slate-400/90"
              )}
              title={validatedName}
            >
              {validatedName}
            </p>
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-sky-300/80 bg-white text-sky-800 shadow-sm hover:bg-sky-50"
              aria-label="Historique de cette ligne"
              title="Historique"
            >
              <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          <div
            className={cn(
              "flex w-full items-end justify-between gap-2 leading-none",
              withdrawnGrey && "opacity-85"
            )}
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-4 gap-y-1">
              <ProductRequestLinePrices
                unitPrice={unitMad}
                totalValue={
                  lineTotalMad != null && row.is_selected_by_patient ? lineTotalMad : null
                }
              />
              <ProductRequestLineQtyInline qty={displayQty} />
            </div>
            <div className="flex shrink-0 self-end">
              <PatientLineNotesIconButton
                productName={validatedName}
                client={row.client_comment ?? ""}
                pharmacist={row.pharmacist_comment ?? ""}
              />
            </div>
          </div>
        </div>
      </div>

      {lineLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-sky-200/55 bg-sky-50/30 px-2.5 py-1.5">
          {lineLabels.map((label) => (
            <span key={label.key} className={validatedLineLabelChipClass(label)}>
              {label.text}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function PatientTraceNotRetainedRow({
  row,
  onOpenHistory,
  postConfirmBadges,
  onPhotoPreview,
  requestType,
}: {
  row: ActionItemRow;
  onOpenHistory: () => void;
  postConfirmBadges?: string[];
  onPhotoPreview?: (url: string, title: string) => void;
  requestType?: string;
}) {
  const prod = one(row.products);
  const name = prod?.name ?? "Produit";
  const eff = row.availability_status;
  const lineKind =
    row.line_source === "pharmacist_proposed" ? (
      <span className={requestType === "prescription" ? "text-amber-900" : "text-violet-800"}>
        {requestType === "prescription"
          ? PRESCRIPTION_ADDITIONAL_PROPOSED_REASON
          : requestItemLineSourceFr.pharmacist_proposed}
      </span>
    ) : null;
  const photoUrl = prod?.photo_url ? resolvePublicMediaUrl(prod.photo_url) : null;
  return (
    <li className="rounded-lg border border-slate-200/75 bg-slate-50/75 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className={VALIDATED_LINE_THUMB}>
          {photoUrl ? (
            onPhotoPreview ? (
              <button
                type="button"
                className={cn("size-full cursor-zoom-in focus:outline-none focus-visible:ring-2", productRequestTheme.photoRing)}
                onClick={() => onPhotoPreview(photoUrl, name)}
                aria-label={`Agrandir la photo · ${name}`}
              >
                <img src={photoUrl} alt="" className="pointer-events-none h-full w-full object-cover opacity-90" />
              </button>
            ) : (
              <img src={photoUrl} alt="" className="h-full w-full object-cover opacity-90" />
            )
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Package className="size-5 text-muted-foreground" aria-hidden />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p
              className="min-w-0 flex-1 truncate text-[12px] font-medium leading-none text-muted-foreground line-through decoration-slate-400/90"
              title={name}
            >
              {name}
            </p>
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-slate-300/80 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              aria-label="Historique de cette ligne"
              title="Historique"
            >
              <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
            </button>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground/80">×{row.requested_qty}</span>
            {eff ? <span>{availabilityStatusFr[eff] ?? eff}</span> : null}
            {lineKind}
          </p>
        </div>
      </div>
      {postConfirmBadges && postConfirmBadges.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-t border-border/50 pt-1">
          {postConfirmBadges.map((label) => (
            <span
              key={label}
              className="inline-flex max-w-full rounded-md border border-slate-300/80 bg-slate-50 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-800"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}
      <PatientRespondedLineConvoStripReadOnly
        patientNote={row.client_comment ?? ""}
        pharmaLineNote={row.pharmacist_comment ?? ""}
      />
    </li>
  );
}

/** Défaut atelier : d’abord le principal disponible, sinon première alternative disponible, sinon rien */
function pickDefaultBranch(row: ActionItemRow, alts: ActionItemAltRow[]): LineBranch {
  if (maxQtyPrincipal(row) > 0) return "principal";
  for (const alt of alts) {
    if (maxQtyAlt(row, alt) > 0) return alt.id;
  }
  return null;
}

function computeSelFromConfirmedItems(items: ActionItemRow[]): Record<string, LineSelState> {
  const next: Record<string, LineSelState> = {};
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    let branch: LineBranch = null;
    if (row.is_selected_by_patient) {
      branch = row.patient_chosen_alternative_id ?? "principal";
    }
    const cap = maxQtyForBranch(row, branch, alts);
    if (branch !== null && cap < 1) branch = null;
    const rawQty = row.selected_qty != null ? Number(row.selected_qty) : row.requested_qty;
    const clamped =
      branch !== null && cap > 0 ? Math.min(Math.max(1, rawQty), cap) : 1;
    const browseQty: Record<string, number> = {};
    if (branch !== null) browseQty[lineBranchKey(branch)] = clamped;
    next[row.id] = { branch, qty: clamped, browseQty };
  }
  return next;
}

function computeSelFromItems(items: ActionItemRow[]): Record<string, LineSelState> {
  const next: Record<string, LineSelState> = {};
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    let branch = pickDefaultBranch(row, alts);
    let cap = maxQtyForBranch(row, branch, alts);
    if (branch !== null && cap < 1) branch = null;
    cap = maxQtyForBranch(row, branch, alts);
    const qty = branch !== null && cap > 0 ? cap : 1;
    const clamped = branch !== null && cap > 0 ? Math.min(qty, cap) : 1;
    const browseQty: Record<string, number> = {};
    if (branch !== null) browseQty[lineBranchKey(branch)] = clamped;
    next[row.id] = { branch, qty: clamped, browseQty };
  }
  return next;
}

type ResubmitLine = {
  product_id: string;
  name: string;
  photo_url?: string | null;
  qty: number;
  unit_price?: number | null;
  price_pph?: number | null;
  client_comment: string;
  pharmacist_comment?: string | null;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
};

/** Tant que la réponse n’est pas publiée, les propositions officine sont un brouillon : le patient ne les voit qu’après `responded`. */
function visibleItemsForPatientBeforePharmacyResponse(items: ActionItemRow[], status: string): ActionItemRow[] {
  if (status !== "submitted" && status !== "in_review") return items;
  return items.filter((row) => row.line_source !== "pharmacist_proposed");
}

function resubmitLineUnitPrice(line: ResubmitLine): number | null {
  if (line.unit_price != null && !Number.isNaN(Number(line.unit_price))) return Number(line.unit_price);
  if (line.price_pph != null && !Number.isNaN(Number(line.price_pph))) return Number(line.price_pph);
  return null;
}

function resubmitLineFromDraftAndServer(
  d: PatientDemandeProduitsDraftLine,
  srv: ResubmitLine | undefined,
  resolveCatalog?: (row: ActionItemRow) => number | null,
  items?: ActionItemRow[]
): ResubmitLine {
  const base = draftLineToResubmitLine(d);
  const itemRow = items?.find((r) => r.product_id === d.product_id);
  const unit_price =
    draftLineUnitPrice(d) ??
    (srv ? resubmitLineUnitPrice(srv) : null) ??
    (itemRow && resolveCatalog ? resolveCatalog(itemRow) : null);
  return {
    product_id: base.product_id,
    name: base.name,
    photo_url: base.photo_url,
    qty: base.qty,
    unit_price,
    price_pph: base.price_pph ?? srv?.price_pph ?? null,
    client_comment: base.client_comment,
    pharmacist_comment: srv?.pharmacist_comment ?? null,
    line_source: srv?.line_source ?? null,
    pharmacist_proposal_reason: srv?.pharmacist_proposal_reason ?? null,
  };
}

function computeResubmitLinesFromItems(
  items: ActionItemRow[],
  resolveCatalog?: (row: ActionItemRow) => number | null
): ResubmitLine[] {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? "Produit",
    photo_url: resolvePublicMediaUrl(one(row.products)?.photo_url ?? null),
    qty: Math.min(10, Math.max(1, row.requested_qty)),
    unit_price: row.unit_price ?? resolveCatalog?.(row) ?? null,
    client_comment: row.client_comment ?? "",
    pharmacist_comment: row.pharmacist_comment ?? "",
    line_source: row.line_source ?? null,
    pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? null,
  }));
}

function resubmitLinesSignature(ls: ResubmitLine[]): string {
  return ls
    .map((l) =>
      [
        l.product_id,
        String(l.qty),
        l.client_comment.trim(),
        (l.pharmacist_comment ?? "").trim(),
        l.line_source ?? "",
        l.pharmacist_proposal_reason ?? "",
      ].join(":")
    )
    .join(">");
}

function patientArchiveClosureLabelFr(row: ActionItemRow): string | null {
  if ((row.counter_outcome ?? "unset") === "picked_up") return "Récupéré";
  if (row.withdrawn_after_confirm) return "Écarté";
  return null;
}

function validatedTierForClosedArchiveRow(row: ActionItemRow): "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation" {
  const { dispoOfficine, aCommander, horsPerimetre } = bucketPatientValidatedLinesThreeWays([row]);
  if (dispoOfficine.some((r) => r.id === row.id)) return "dispo_officine";
  if (aCommander.some((r) => r.id === row.id)) return "commande";
  if (horsPerimetre.some((r) => r.id === row.id)) return "hors_perimetre";
  return row.withdrawn_after_confirm ? "retire_apres_validation" : "dispo_officine";
}

function closedArchiveBucketSectionClass(
  bucketId: (typeof PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER)[number]
): string {
  switch (bucketId) {
    case "recuperes":
      return "border-emerald-300/90 bg-emerald-50/40 ring-emerald-200/65";
    case "ecartes":
      return "border-red-200/85 bg-red-50/30 ring-red-100/70";
    case "non_retenus":
      return "border-sky-200/60 bg-sky-50/25 ring-sky-100/55";
    default:
      return "border-slate-200/80 bg-slate-50/50";
  }
}

/** Archive patient : même disposition que l’écran « gelé » avant fermeture (lecture seule). */
function PatientArchiveFrozenProductsView({
  snapshotStatus,
  terminalStatus,
  items,
  archiveSel,
  productsSectionTitle,
  badgeForRow,
  requestType,
  supplyAmendmentBundles,
  pricingConfig,
  onOpenLineHistory,
  onPhotoPreview,
  pharmacistProposedBadgeLabel,
  resolveCatalogUnitPriceForProduct,
}: {
  snapshotStatus: import("@/lib/request-archive-snapshot-status").RequestArchiveSnapshotStatus;
  terminalStatus: string;
  items: ActionItemRow[];
  archiveSel: Record<string, LineSelState>;
  productsSectionTitle: string;
  badgeForRow: (row: ActionItemRow) => string | undefined;
  requestType: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  pricingConfig: PharmacyPricingConfig | null;
  onOpenLineHistory: (itemId: string) => void;
  onPhotoPreview: (url: string, title: string) => void;
  pharmacistProposedBadgeLabel: string;
  resolveCatalogUnitPriceForProduct: (
    productId: string,
    embed: {
      product_type?: string | null;
      price_pph?: number | null;
      price_ppv?: number | null;
      laboratory?: string | null;
    } | null
  ) => number | null;
}) {
  const noop = () => {};

  if (snapshotStatus === "submitted" || snapshotStatus === "in_review") {
    return (
      <section className="mt-4 space-y-2 opacity-95">
        <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {productsSectionTitle}
        </h3>
        <ul className="w-full min-w-0 space-y-1.5">
          {items.map((row) => {
            const prod = one(row.products);
            const unit = validatedBranchUnitPriceMad(row, pricingConfig, row.product_id);
            return (
              <PatientProductRequestCompactLine
                key={row.id}
                line={{
                  product_id: row.product_id,
                  name: prod?.name ?? "Produit",
                  photo_url: prod?.photo_url ?? null,
                  qty: row.requested_qty,
                  client_comment: row.client_comment ?? "",
                  line_source: row.line_source,
                  pharmacist_proposal_reason: row.pharmacist_proposal_reason,
                }}
                unitPrice={unit}
                editMode={false}
                onPhotoPreview={() => {
                  const url = prod?.photo_url;
                  if (url) onPhotoPreview(resolvePublicMediaUrl(url) ?? url, prod?.name ?? "Produit");
                }}
                onSetQty={noop}
              />
            );
          })}
        </ul>
      </section>
    );
  }

  if (snapshotStatus === "responded") {
    const respondedBuckets = bucketPatientRespondedLines(items, requestType, supplyAmendmentBundles);
    return (
      <section className="mt-4 space-y-3 opacity-95">
        <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {productsSectionTitle}
        </h3>
        <div className="space-y-4">
          {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
            const rows = respondedBuckets[bucketId];
            if (rows.length === 0) return null;
            return (
              <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length}>
                <ul className="w-full min-w-0 space-y-2.5 overflow-visible">
                  {rows.map((row) => (
                    <RespondedPatientLineChooser
                      key={row.id}
                      row={row}
                      selState={archiveSel[row.id] ?? emptyLineSelState()}
                      setLineBranch={noop}
                      setLineQty={noop}
                      toggleLineRetention={noop}
                      onPhotoPreview={onPhotoPreview}
                      pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                      requestType={requestType}
                      supplyAmendmentBundles={supplyAmendmentBundles}
                      resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
                      readOnly
                    />
                  ))}
                </ul>
              </PatientRespondedBucketSection>
            );
          })}
        </div>
      </section>
    );
  }

  if (isPatientProductClosedArchiveStatus(terminalStatus)) {
    const closedBuckets = bucketPatientClosedArchiveLines(items);
    const pickedUpTotals = monetaryTotalsForRetainedLines(closedBuckets.recuperes, terminalStatus, pricingConfig);

    const renderClosedValidatedCard = (row: ActionItemRow) => (
      <PatientValidatedCompactLineCard
        key={row.id}
        row={row}
        tier={validatedTierForClosedArchiveRow(row)}
        onOpenHistory={() => onOpenLineHistory(row.id)}
        requestStatusForCard={terminalStatus}
        archiveClosureLabel={patientClosedArchiveClosureLabelFr(row)}
        onPhotoPreview={onPhotoPreview}
        pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
        requestType={requestType}
        supplyAmendmentBundles={supplyAmendmentBundles}
        pricingConfig={pricingConfig}
      />
    );

    return (
      <section className="mt-4 space-y-3 opacity-95">
        <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {productsSectionTitle}
        </h3>

        {PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER.map((bucketId) => {
          const rows = closedBuckets[bucketId];
          if (rows.length === 0) return null;

          if (bucketId === "non_retenus") {
            return (
              <details
                key={bucketId}
                className={clsx(
                  "group rounded-xl border-2 ring-1",
                  closedArchiveBucketSectionClass(bucketId)
                )}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-sky-950 [&::-webkit-details-marker]:hidden">
                  <span className="text-[11px] font-extrabold uppercase tracking-wide">
                    {patientClosedArchiveBucketTitleFr(bucketId)}
                    <span className="ml-1 font-bold tabular-nums text-muted-foreground">· {rows.length}</span>
                  </span>
                  <ChevronDown
                    className="size-3.5 shrink-0 text-sky-700 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <ul className="space-y-2 border-t border-sky-200/50 px-2.5 py-2">
                  {rows.map((row) => (
                    <PatientTraceNotRetainedRow
                      key={row.id}
                      row={row}
                      requestType={requestType}
                      onOpenHistory={() => onOpenLineHistory(row.id)}
                      onPhotoPreview={onPhotoPreview}
                    />
                  ))}
                </ul>
              </details>
            );
          }

          return (
            <section
              key={bucketId}
              className={clsx("space-y-2 rounded-xl border-2 p-2 ring-1", closedArchiveBucketSectionClass(bucketId))}
            >
              <div className="flex flex-nowrap items-center justify-between gap-2 px-0.5">
                <h4
                  className={clsx(
                    "min-w-0 text-[11px] font-extrabold uppercase tracking-wide",
                    bucketId === "recuperes" ? "text-emerald-950" : "text-red-950"
                  )}
                >
                  {patientClosedArchiveBucketTitleFr(bucketId)}
                  <span className="ml-1 font-bold tabular-nums text-muted-foreground">· {rows.length}</span>
                </h4>
                {bucketId === "recuperes" ? (
                  <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-emerald-900">
                    {compactTotalMadLabel({
                      sumKnown: pickedUpTotals.sumKnown,
                      missingPrice: pickedUpTotals.missingPrice,
                      empty: pickedUpTotals.count < 1,
                    })}
                  </p>
                ) : null}
              </div>
              <ul className="space-y-2.5">
                {rows.map((row) => renderClosedValidatedCard(row))}
              </ul>
            </section>
          );
        })}

        {pickedUpTotals.count > 0 ? (
          <div className="flex flex-nowrap items-center justify-between gap-3 rounded-lg border border-emerald-200/80 bg-white/80 px-3 py-2.5 shadow-sm">
            <p className="text-sm font-medium text-slate-700">
              <span className="font-bold tabular-nums text-slate-950">{pickedUpTotals.count}</span>{" "}
              {pickedUpTotals.count > 1 ? "produits récupérés" : "produit récupéré"}
            </p>
            <p className="shrink-0 text-lg font-bold tabular-nums text-emerald-900">
              {compactTotalMadLabel({
                sumKnown: pickedUpTotals.sumKnown,
                missingPrice: pickedUpTotals.missingPrice,
                empty: pickedUpTotals.count < 1,
              })}
            </p>
          </div>
        ) : null}
      </section>
    );
  }

  const { dispoOfficine, aCommander, horsPerimetre, retireesApresValidation } =
    bucketPatientValidatedLinesThreeWays(items);
  const dispoRetenues = dispoOfficine.filter((r) => r.is_selected_by_patient);
  const aCommanderRetenues = aCommander.filter((r) => r.is_selected_by_patient);
  const horsPerimetreRetenues = horsPerimetre.filter((r) => r.is_selected_by_patient);
  const lignesNonRetenues = items.filter((r) => !r.is_selected_by_patient);
  const subtotalDispo = monetaryTotalsForRetainedLines(dispoRetenues, terminalStatus, pricingConfig);
  const subtotalCommande = monetaryTotalsForRetainedLines(aCommanderRetenues, terminalStatus, pricingConfig);
  const isTreatedSnapshot = snapshotStatus === "treated";
  const cardStatus = isTreatedSnapshot ? "treated" : terminalStatus;
  const totalsRetained = monetaryTotalsForRetainedLines(
    items.filter((r) => r.is_selected_by_patient && !r.withdrawn_after_confirm),
    terminalStatus,
    pricingConfig
  );

  return (
    <section className="mt-4 space-y-3 opacity-95">
      <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {productsSectionTitle}
      </h3>

      {dispoRetenues.length > 0 ? (
        <section className="space-y-2 rounded-xl border-2 border-sky-300/90 bg-sky-50/35 p-2 ring-1 ring-sky-200/60">
          <div className="flex flex-nowrap items-center justify-between gap-2 px-0.5 text-sky-950">
            <div className="flex min-w-0 items-center gap-1.5">
              <Package className="size-4 shrink-0 text-sky-700" aria-hidden />
              <h4
                className={clsx(
                  "min-w-0 font-extrabold uppercase tracking-wide text-sky-950",
                  isTreatedSnapshot ? "text-[10px] leading-snug sm:text-[11px]" : "text-[11px]"
                )}
              >
                {isTreatedSnapshot
                  ? "Produits réservés pour vous et en attente de votre passage"
                  : `À réserver · ${dispoRetenues.length}`}
              </h4>
            </div>
            <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-sky-800">
              {compactTotalMadLabel({
                sumKnown: subtotalDispo.sumKnown,
                missingPrice: subtotalDispo.missingPrice,
                empty: subtotalDispo.count < 1,
              })}
            </p>
          </div>
          <ul className="space-y-2.5">
            {dispoRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="dispo_officine"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={patientArchiveClosureLabelFr(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {aCommanderRetenues.length > 0 ? (
        <section className="space-y-2 rounded-xl border-2 border-teal-400/85 bg-teal-50/40 p-2 ring-1 ring-teal-200/65">
          <div className="flex flex-nowrap items-center justify-between gap-2 px-0.5 text-teal-950">
            <div className="flex min-w-0 items-center gap-1.5">
              <ShoppingCart className="size-4 shrink-0 text-teal-800" aria-hidden />
              <h4
                className={clsx(
                  "min-w-0 font-extrabold uppercase tracking-wide text-teal-950",
                  isTreatedSnapshot ? "text-[10px] leading-snug sm:text-[11px]" : "text-[11px]"
                )}
              >
                {isTreatedSnapshot ? "Produits commandés pour vous" : `À commander · ${aCommanderRetenues.length}`}
              </h4>
            </div>
            <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-teal-900">
              {compactTotalMadLabel({
                sumKnown: subtotalCommande.sumKnown,
                missingPrice: subtotalCommande.missingPrice,
                empty: subtotalCommande.count < 1,
              })}
            </p>
          </div>
          <ul className="space-y-2.5">
            {aCommanderRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="commande"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={patientArchiveClosureLabelFr(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {horsPerimetreRetenues.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/25 p-2 ring-1 ring-amber-100/60">
          <div className="flex items-center gap-1.5 px-0.5 text-amber-950">
            <Layers className="size-4 shrink-0 text-amber-800" aria-hidden />
            <h4 className="text-[11px] font-extrabold uppercase tracking-wide">Point d&apos;attention</h4>
          </div>
          <ul className="space-y-2.5">
            {horsPerimetreRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="hors_perimetre"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={patientArchiveClosureLabelFr(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {retireesApresValidation.length > 0 ? (
        <details className="group rounded-xl border border-red-200/85 bg-red-50/30 ring-1 ring-red-100/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-red-950 [&::-webkit-details-marker]:hidden">
            <span className="text-[11px] font-extrabold uppercase tracking-wide">
              Écart après validation · {retireesApresValidation.length}
            </span>
            <ChevronDown className="size-3.5 shrink-0 text-red-700 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-red-200/70 px-2.5 pb-2.5 pt-2">
            <ul className="space-y-2.5">
              {retireesApresValidation.map((row) => (
                <PatientValidatedCompactLineCard
                  key={row.id}
                  row={row}
                  tier="retire_apres_validation"
                  onOpenHistory={() => onOpenLineHistory(row.id)}
                  requestStatusForCard={cardStatus}
                  archiveClosureLabel={patientArchiveClosureLabelFr(row)}
                  onPhotoPreview={onPhotoPreview}
                  pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                  requestType={requestType}
                  supplyAmendmentBundles={supplyAmendmentBundles}
                  pricingConfig={pricingConfig}
                />
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {lignesNonRetenues.length > 0 ? (
        <details className="group rounded-lg border border-sky-200/60 bg-sky-50/25">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold text-sky-950 [&::-webkit-details-marker]:hidden">
            <span>Lignes non retenues ({lignesNonRetenues.length})</span>
            <ChevronDown className="size-3.5 shrink-0 text-sky-700 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="space-y-2 border-t border-sky-200/50 px-2.5 py-2">
            {lignesNonRetenues.map((row) => (
              <PatientTraceNotRetainedRow
                key={row.id}
                row={row}
                requestType={requestType}
                onOpenHistory={() => onOpenLineHistory(row.id)}
                onPhotoPreview={onPhotoPreview}
              />
            ))}
          </ul>
        </details>
      ) : null}

      {totalsRetained.count > 0 ? (
        <div className="flex flex-nowrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-white/80 px-3 py-2.5 shadow-sm">
          <p className="text-sm font-medium text-slate-700">
            <span className="font-bold tabular-nums text-slate-950">{totalsRetained.count}</span>{" "}
            {totalsRetained.count > 1 ? "produits retenus" : "produit retenu"}
          </p>
          <p className="shrink-0 text-lg font-bold tabular-nums text-sky-900">
            {compactTotalMadLabel({
              sumKnown: totalsRetained.sumKnown,
              missingPrice: totalsRetained.missingPrice,
              empty: totalsRetained.count < 1,
            })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

/** Bandeau notes (même style que répondu / validé) + modal lecture seule. */
function PatientSentLineNotesModalFr({
  productName,
  client,
  pharmacist,
}: {
  productName: string;
  client: string;
  pharmacist: string;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const c = client.trim();
  const p = pharmacist.trim();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasNotes = Boolean(c || p);

  return (
    <>
      <ProductRequestLineMessageIconButton
        hasComment={hasNotes}
        onClick={() => setOpen(true)}
      />
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200/90 bg-card shadow-2xl ring-1 ring-slate-900/10"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      <span className="block">Notes — produit</span>
                      <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">{productName}</span>
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(60vh,16rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {!c && !p ? (
                    <p className="text-[11px] leading-snug text-muted-foreground">Aucune note sur ce produit.</p>
                  ) : null}
                  {c ? (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{c}</p>
                    </div>
                  ) : null}
                  {p ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-900">Officine</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-emerald-950">{p}</p>
                    </div>
                  ) : null}
                </div>
                <div className="border-t border-border/60 px-3 py-2">
                  <button
                    type="button"
                    className="h-9 w-full rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                    onClick={() => setOpen(false)}
                  >
                    Fermer
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function summaryThemeClasses(accent: RequestKindAccent) {
  if (accent === "amber") {
    return {
      shell: "mb-2 rounded-lg border border-amber-200/60 bg-amber-50/30 px-2 py-1.5 text-[10px] leading-snug shadow-sm sm:px-2.5",
      borderB: "border-amber-200/70",
      borderB2: "border-amber-200/60",
      title: "text-amber-950",
      meta: "text-amber-900/90",
      chip: "border-amber-300/60 text-amber-900",
      link: "text-amber-800",
      contactBtn: "border-amber-400/70 text-amber-950 hover:bg-amber-50",
      contactIcon: "text-amber-700",
      contactPanel: "border-amber-200 ring-amber-200/60",
      metaRow: "text-amber-950/88",
      metaLabel: "text-amber-900/90",
      hint: "text-amber-950/90",
    };
  }
  if (accent === "violet") {
    return {
      shell: "mb-2 rounded-lg border border-violet-200/60 bg-violet-50/30 px-2 py-1.5 text-[10px] leading-snug shadow-sm sm:px-2.5",
      borderB: "border-violet-200/70",
      borderB2: "border-violet-200/60",
      title: "text-violet-950",
      meta: "text-violet-900/90",
      chip: "border-violet-300/60 text-violet-900",
      link: "text-violet-800",
      contactBtn: "border-violet-400/70 text-violet-950 hover:bg-violet-50",
      contactIcon: "text-violet-700",
      contactPanel: "border-violet-200 ring-violet-200/60",
      metaRow: "text-violet-950/88",
      metaLabel: "text-violet-900/90",
      hint: "text-violet-950/90",
    };
  }
  return {
    shell: "mb-2 rounded-lg border border-sky-200/60 bg-sky-50/30 px-2 py-1.5 text-[10px] leading-snug shadow-sm sm:px-2.5",
    borderB: "border-sky-200/70",
    borderB2: "border-sky-200/60",
    title: "text-sky-950",
    meta: "text-sky-900/90",
    chip: "border-sky-300/60 text-sky-900",
    link: "text-sky-800",
    contactBtn: "border-sky-400/70 text-sky-950 hover:bg-sky-50",
    contactIcon: "text-sky-700",
    contactPanel: "border-sky-200 ring-sky-200/60",
    metaRow: "text-sky-950/88",
    metaLabel: "text-sky-900/90",
    hint: "text-sky-950/90",
  };
}

export function PatientSentEnvoyeeSummaryCard({
  pharmacyContact,
  pharmacyId,
  dossierRefLabel,
  lineCountLabel,
  status,
  createdAt,
  updatedAt,
  kindLabel: _kindLabel,
  refShort,
  statusHint,
  accent = "sky",
}: {
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  dossierRefLabel: string;
  lineCount: number;
  lineCountLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  kindLabel: string;
  refShort: string;
  statusHint: string;
  accent?: RequestKindAccent;
}) {
  const ph = pharmacyContact;
  const phName =
    ph?.nom?.trim() != null && ph.nom.trim() !== "" ? pharmacyPublicLabel(ph.nom.trim()) : "Officine";
  const phVille = ph?.ville?.trim() || null;
  const phRef = ph?.public_ref?.trim();
  const t = summaryThemeClasses(accent);
  return (
    <div className={t.shell}>
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1 border-b border-sky-200/70 pb-1.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-[11px] font-bold leading-snug break-words text-sky-950">{phName}</p>
          {phVille ? <p className="text-[10px] font-medium text-sky-800/85">{phVille}</p> : null}
          {phRef ? (
            <p className="text-[9px] text-sky-900/90">
              <span className="font-mono font-semibold text-foreground">Off. {phRef}</span>
            </p>
          ) : null}
          <Link
            href={`/pharmacie/${pharmacyId}`}
            className="text-[9px] font-semibold text-sky-800 underline underline-offset-2"
          >
            Fiche officine
          </Link>
        </div>
        {ph ? (
          <details className="group relative shrink-0">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-sky-400/70 bg-white/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-sky-950 shadow-sm marker:content-none hover:bg-sky-50 [&::-webkit-details-marker]:hidden">
              Contacter
              <ChevronDown className="size-3 text-sky-700 transition group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-[60] mt-1 min-w-[12rem] max-w-[min(100vw-2rem,18rem)] rounded-lg border border-sky-200 bg-card p-2 shadow-lg ring-1 ring-sky-200/60">
              <PatientPharmacyQuickContact pharmacy={ph} requestRef={dossierRefLabel} variant="iconsOnly" />
            </div>
          </details>
        ) : null}
      </div>
      <p className={clsx("mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 border-b pb-1.5 text-[9px] tabular-nums", t.borderB2, t.metaRow)}>
        <span className="font-mono font-semibold text-foreground">
          {refShort} {dossierRefLabel}
        </span>
        <span aria-hidden>·</span>
        <span className="font-semibold">{lineCountLabel}</span>
        <span aria-hidden>·</span>
        <span className="font-medium text-foreground">
          {updatedAt?.trim() && updatedAt !== createdAt
            ? formatDateTimeShort24hFr(updatedAt)
            : createdAt
              ? formatDateTimeShort24hFr(createdAt)
              : "—"}
        </span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-start gap-2">
        <span className="shrink-0 rounded-full border border-amber-300/90 bg-amber-50 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-amber-950">
          {requestStatusFr[status] ?? status}
        </span>
        <p className={clsx("min-w-0 flex-1 text-[9px] leading-snug", t.hint)}>{statusHint}</p>
      </div>
    </div>
  );
}

type ProductHit = {
  id: string;
  name: string;
  product_type: string;
  laboratory: string | null;
  photo_url?: string | null;
  price_pph?: number | null;
};

type Props = {
  requestId: string;
  status: string;
  items: ActionItemRow[];
  initialPlannedVisitDate?: string | null;
  initialPlannedVisitTime?: string | null;
  onReload: () => Promise<void>;
  /** Coordonnées officine : affichées une fois la demande validée (passage direct). */
  pharmacyContact?: PatientPharmacyContactInfo | null;
  /** Référence courte (ex. PR-…) pour préremplir un courriel. */
  requestPublicRef?: string | null;
  supplyAmendmentBundles?: { id: string; created_at: string; amendments: unknown }[];
  /** Dates dossier pour la timeline produit après validation */
  requestTimelineMeta?: {
    created_at: string;
    submitted_at: string | null;
    responded_at: string | null;
    confirmed_at: string | null;
    expires_at?: string | null;
  };
  /** Note globale saisie à l’envoi (product_requests.patient_note). */
  productPatientNote?: string | null;
  /** `request_status_history` (filtre audit par produit dans le modal). */
  dossierHistoryRows?: { id: string; created_at: string; old_status: string | null; new_status: string; reason: string | null }[];
  /** Pour lien annuaire + récap « envoyées ». */
  pharmacyId?: string | null;
  requestUpdatedAt?: string | null;
  requestType?: string;
  prescriptionPaths?: PrescriptionPagePaths | null;
  prescriptionNote?: string | null;
  /** Récap dossier déjà affiché dans le chrome sticky consultation (évite le doublon). */
  summaryInPageChrome?: boolean;
  /** Dossier modifié côté serveur pendant la saisie — actualisation requise. */
  detailStale?: { title: string; message: string } | null;
  /** Statut DB juste avant fermeture (annulée, abandonnée, etc.). */
  archiveTerminalOldStatus?: string | null;
};

export function buildPatientSummaryStatusHint(
  status: string,
  requestType: string,
  _workflow: ReturnType<typeof getRequestKindWorkflowCopy>
): string {
  if (status === "responded") return "Validez votre choix et votre date de passage.";
  if (status === "confirmed") {
    return requestType === "prescription"
      ? "Préparation en cours selon l'ordonnance."
      : "Préparation en cours à l'officine.";
  }
  if (status === "treated") return "Passez à l'officine pour retirer vos produits.";
  if (status === "in_review") return "L'officine examine votre demande.";
  return "Demande envoyée — en attente de réponse.";
}

/** Détail affiché dans le modal (i) du bandeau dossier. */
export function buildPatientSummaryStatusDetail(
  status: string,
  requestType: string,
  workflow: ReturnType<typeof getRequestKindWorkflowCopy>
): string | null {
  if (status === "responded") {
    return "Pour chaque produit : garder ou non, quantité, alternative éventuelle, puis date de passage et validation.";
  }
  if (status === "confirmed") {
    return requestType === "prescription"
      ? "La pharmacie prépare votre commande selon les produits saisis sur l'ordonnance. Les mises à jour restent visibles sur cette page."
      : "Votre pharmacie prépare la commande (mise de côté et commandes fournisseur selon les produits). Les mises à jour restent visibles sur cette page.";
  }
  if (status === "treated") {
    return "Vous pouvez passer à l'officine pour retirer les produits réservés et ceux commandés déjà reçus. Le suivi par produit est indiqué sur chaque carte.";
  }
  if (status === "in_review") return workflow.patientWaitingInReviewHint;
  return workflow.patientWaitingSubmittedHint;
}

export function buildPatientLineCountLabel(
  requestType: string,
  status: string,
  lineCount: number
): string {
  if (requestType === "prescription" && ["submitted", "in_review"].includes(status)) {
    return "Scan envoyé";
  }
  if (requestType === "prescription" && lineCount > 0) {
    return `${lineCount} produit${lineCount > 1 ? "s" : ""} saisi${lineCount > 1 ? "s" : ""}`;
  }
  if (requestType === "free_consultation") {
    if (["submitted", "in_review"].includes(status)) return "Consultation envoyée";
    if (lineCount > 0) return `${lineCount} produit${lineCount > 1 ? "s" : ""} proposé${lineCount > 1 ? "s" : ""}`;
    return "Consultation";
  }
  return `${lineCount} ligne${lineCount > 1 ? "s" : ""}`;
}

function clampVisitYmd(ymd: string, minY: string, maxY: string): string {
  if (ymd < minY) return minY;
  if (ymd > maxY) return maxY;
  return ymd;
}

function htmlTimeToPg(t: string): string | null {
  const s = t.trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return s;
}

/** Bandeau + modal lecture seule (échanges patient / pharmacie sur la ligne). */
function PatientRespondedLineConvoStripReadOnly({
  patientNote,
  pharmaLineNote,
  layout = "footer",
}: {
  patientNote: string;
  pharmaLineNote: string;
  /** `embedded` : sous la dispo, pleine largeur. `inline` : à côté de Qté (carte compacte validée). */
  layout?: "footer" | "embedded" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const visual = lineConversationVisual(patientNote, pharmaLineNote);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const wrapCls =
    layout === "inline"
      ? "flex shrink-0 justify-end"
      : layout === "embedded"
        ? "mt-1.5 flex w-full min-w-0 justify-stretch pt-0"
        : "mt-1.5 flex w-full min-w-0 justify-end border-t border-dotted border-border/55 pt-1.5";

  return (
    <>
      <div className={wrapCls}>
        <button
          type="button"
          className={clsx(
            lineConversationStripButtonClass(visual, { open, disabled: false }),
            layout === "embedded" && "w-full max-w-none justify-start"
          )}
          aria-label={`Échanges sur ce produit · ${lineConversationStripLabel(visual)}`}
          title="Voir les messages (lecture seule)"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
        >
          <MessageCircle className="size-3.5 shrink-0 opacity-90" strokeWidth={2.2} aria-hidden />
          <span className="max-w-[11rem] truncate text-[9px] font-medium leading-tight sm:max-w-[14rem]">
            {lineConversationStripLabel(visual)}
          </span>
        </button>
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-3 backdrop-blur-[1px] sm:items-center"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Échanges sur la ligne"
                className="max-h-[min(80vh,22rem)] w-full max-w-md overflow-hidden rounded-2xl border border-border/90 bg-card shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
                  <p className="text-[11px] font-bold text-foreground">Sur ce produit</p>
                  <button
                    type="button"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted/60"
                    aria-label="Fermer"
                    onClick={() => setOpen(false)}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="max-h-[min(65vh,18rem)] space-y-2 overflow-y-auto overscroll-y-contain px-3 py-2.5 text-[11px] [-webkit-overflow-scrolling:touch]">
                  {patientNote.trim() ? (
                    <div className="rounded-lg border border-sky-200/80 bg-sky-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-sky-900">Vous</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-sky-950">{patientNote.trim()}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-muted-foreground">Aucun commentaire de votre part sur ce produit.</p>
                  )}
                  {pharmaLineNote.trim() ? (
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-2">
                      <p className="text-[8px] font-bold uppercase tracking-wide text-emerald-900">Pharmacie</p>
                      <p className="mt-0.5 whitespace-pre-wrap break-words leading-snug text-emerald-950">{pharmaLineNote.trim()}</p>
                    </div>
                  ) : (
                    <p className="text-[10px] italic text-muted-foreground">Aucune note de la pharmacie sur ce produit.</p>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}


function splitVisitHm(raw: string | null | undefined): { h: string; m: string } {
  if (!raw) return { h: "", m: "" };
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return { h: "", m: "" };
  return { h: m[1] ?? "", m: m[2] ?? "" };
}

type PatientConfirmRpcRow = {
  request_item_id: string;
  is_selected: boolean;
  selected_qty: number | null;
  chosen_alternative_id: string | null;
};

type PatientConfirmPreviewLine = {
  rowId: string;
  productName: string;
  choiceDetail: string;
  qty: number;
  unitPriceMad: number | null;
  lineTotalMad: number | null;
  bucket: "reserve" | "order";
  etaLabel: string | null;
  photoUrl: string | null;
};

type PatientConfirmSkippedLine = {
  rowId: string;
  productName: string;
  isProposed: boolean;
  skipLabel?: string | null;
};

type PatientConfirmReviewSnapshot = {
  rpcPayload: PatientConfirmRpcRow[];
  preview: PatientConfirmPreviewLine[];
  skippedLines: PatientConfirmSkippedLine[];
  plannedVisitDate: string;
  plannedVisitTimePg: string | null;
  visitSummaryFr: string;
};

function buildPatientConfirmSelection(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>,
  requestType: string,
  amendmentBundles: { amendments: unknown }[]
): { rpcPayload: PatientConfirmRpcRow[]; preview: PatientConfirmPreviewLine[] } {
  const preview: PatientConfirmPreviewLine[] = [];
  const rpcPayload = items.map((row) => {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const st = sel[row.id] ?? emptyLineSelState();
    const cap = maxQtyForBranch(row, st.branch, alts);
    const on = st.branch !== null && cap > 0;
    const qty = on ? Math.min(lineSelQtyForBranch(st, st.branch!, cap), cap) : null;
    const chosenAlt = on && st.branch !== null && st.branch !== "principal" ? st.branch : null;

    if (on && qty != null) {
      const principalProd = one(row.products);
      let productName: string;
      let unitPrice: number | null;
      let effStatus: string | null;
      let eta: string | null = null;
      let choiceDetail: string;
      let photoUrl: string | null;

      if (st.branch === "principal") {
        productName = principalProd?.name ?? "Produit";
        unitPrice = row.unit_price != null ? Number(row.unit_price) : null;
        effStatus = row.availability_status;
        try {
          effStatus = inferAvailabilityStatusFromQty({
            status: row.availability_status ?? "available",
            availableQty: Number(row.available_qty ?? 0),
            requestedQty: Math.max(1, Number(row.requested_qty) || 1),
            isProposedLine: false,
          });
        } catch {
          effStatus = row.availability_status;
        }
        choiceDetail = patientPrescriptionChoiceDetail({
          requestType,
          row,
          amendmentBundles,
          branch: "principal",
        });
        if (effStatus === "to_order" && row.expected_availability_date) {
          eta = formatDateShortFr(row.expected_availability_date);
        }
        photoUrl = resolvePublicMediaUrl(principalProd?.photo_url ?? null);
      } else {
        const alt = alts.find((a) => a.id === st.branch);
        const altProd = alt ? one(alt.products) : null;
        productName = altProd?.name ?? "Alternative";
        unitPrice = alt?.unit_price != null ? Number(alt.unit_price) : null;
        effStatus = alt?.availability_status ?? null;
        try {
          effStatus = inferAvailabilityStatusFromQty({
            status: alt?.availability_status ?? "available",
            availableQty: Number(alt?.available_qty ?? 0),
            requestedQty: Math.max(1, Number(row.requested_qty) || 1),
            isProposedLine: false,
          });
        } catch {
          effStatus = alt?.availability_status ?? null;
        }
        choiceDetail = patientPrescriptionChoiceDetail({
          requestType,
          row,
          amendmentBundles,
          branch: "alternative",
        });
        if (effStatus === "to_order" && alt?.expected_availability_date) {
          eta = formatDateShortFr(alt.expected_availability_date);
        }
        photoUrl = resolvePublicMediaUrl(altProd?.photo_url ?? null);
      }

      const lineTotalMad =
        unitPrice != null && Number.isFinite(unitPrice) ? unitPrice * qty : null;
      const bucket: "reserve" | "order" = effStatus === "to_order" ? "order" : "reserve";

      preview.push({
        rowId: row.id,
        productName,
        choiceDetail,
        qty,
        unitPriceMad: unitPrice,
        lineTotalMad,
        bucket,
        etaLabel: eta,
        photoUrl,
      });
    }

    return {
      request_item_id: row.id,
      is_selected: on,
      selected_qty: qty,
      chosen_alternative_id: chosenAlt,
    };
  });

  return { rpcPayload, preview };
}

function buildNonRetainedConfirmLines(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>,
  requestType: string,
  amendmentBundles: { amendments: unknown }[]
): PatientConfirmSkippedLine[] {
  const out: PatientConfirmSkippedLine[] = [];
  for (const row of items) {
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const st = sel[row.id] ?? emptyLineSelState();
    const cap = maxQtyForBranch(row, st.branch, alts);
    const on = st.branch !== null && cap > 0;
    if (!on) {
      const isRxProp = requestType === "prescription" && row.line_source === "pharmacist_proposed";
      const isExtra =
        isRxProp && isPrescriptionAdditionalProposedLine(requestType, row, amendmentBundles);
      out.push({
        rowId: row.id,
        productName: one(row.products)?.name ?? "Produit",
        isProposed: isExtra || (row.line_source === "pharmacist_proposed" && requestType !== "prescription"),
        skipLabel: isRxProp
          ? PRESCRIPTION_ADDITIONAL_PROPOSED_REASON
          : row.line_source === "pharmacist_proposed"
            ? "Proposition"
            : null,
      });
    }
  }
  return out;
}

function validatePatientConfirmBeforeReview(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>,
  rpcPayload: PatientConfirmRpcRow[],
  visitWin: ReturnType<typeof plannedVisitWindow>,
  resolvedVisitDate: string,
  visitDateRaw: string
): string | null {
  const anyOn = rpcPayload.some((p) => p.is_selected);
  if (!anyOn) {
    return "Garde au moins une ligne sélectionnée, modifie ta liste avant renvoi, ou abandonne la demande.";
  }
  for (const row of items) {
    const st = sel[row.id];
    if (!st || st.branch === null) continue;
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const cap = maxQtyForBranch(row, st.branch, alts);
    if (cap < 1) continue;
    const effQty = lineSelQtyForBranch(st, st.branch!, cap);
    if (effQty > cap) {
      const alt = st.branch !== "principal" ? alts.find((a) => a.id === st.branch) : null;
      const label =
        st.branch === "principal" ? (one(row.products)?.name ?? "Produit") : (one(alt?.products)?.name ?? "Alternative");
      return `Pour « ${label} », la quantité ne peut pas dépasser ${cap} (proposée par la pharmacie). Vous pouvez diminuer, pas augmenter.`;
    }
  }
  if (visitWin.missingEtaOnToOrder) {
    return "Une ligne « à commander » n’a pas de date de réception côté pharmacie. Contacte l’officine ou modifie ta sélection.";
  }
  const rawVisit = visitDateRaw.trim();
  if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
    return visitWin.hasToOrder
      ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
      : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`;
  }
  return null;
}

function blockMonetarySummary(lines: PatientConfirmPreviewLine[]): { sumKnown: number; missingUnitPrice: boolean } {
  let sumKnown = 0;
  let missingUnitPrice = false;
  for (const L of lines) {
    if (L.lineTotalMad == null) missingUnitPrice = true;
    else sumKnown += L.lineTotalMad;
  }
  return { sumKnown, missingUnitPrice };
}

function formatBlockSubtotalLabel(lines: PatientConfirmPreviewLine[]): string {
  const { sumKnown, missingUnitPrice } = blockMonetarySummary(lines);
  if (lines.length === 0) return "";
  if (missingUnitPrice && sumKnown === 0) return "Sous-total du bloc — prix non communiqué sur une ou plusieurs lignes";
  if (missingUnitPrice) return `Sous-total du bloc (partiel) · ${sumKnown.toFixed(2)} MAD · certaines lignes sans prix unitaire`;
  return `Sous-total du bloc · ${sumKnown.toFixed(2)} MAD`;
}

function formatGrandTotalLabel(all: PatientConfirmPreviewLine[]): string {
  const { sumKnown, missingUnitPrice } = blockMonetarySummary(all);
  if (all.length === 0) return "";
  if (missingUnitPrice && sumKnown === 0) return "TOTAL: — (prix incomplet)";
  if (missingUnitPrice) return `TOTAL: ${sumKnown.toFixed(2)} MAD (partiel)`;
  return `TOTAL: ${sumKnown.toFixed(2)} MAD`;
}

function PatientConfirmReviewLineCard({
  line,
  onPhotoPreview,
}: {
  line: PatientConfirmPreviewLine;
  onPhotoPreview?: (url: string, title: string) => void;
}) {
  const isOrder = line.bucket === "order";

  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-2 shadow-sm",
        isOrder ? "border-teal-200/90 ring-1 ring-teal-100/80" : "border-sky-200/90 ring-1 ring-sky-100/80"
      )}
    >
      <div className="flex items-stretch gap-2">
        <div
          className={cn(
            "relative size-14 shrink-0 overflow-hidden rounded-md border bg-card",
            isOrder ? "border-teal-200/80" : "border-sky-200/80"
          )}
        >
          {line.photoUrl ? (
            onPhotoPreview ? (
              <button
                type="button"
                className="relative size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                onClick={() => onPhotoPreview(line.photoUrl!, line.productName)}
                aria-label={`Agrandir la photo · ${line.productName}`}
              >
                <img src={line.photoUrl} alt="" className="pointer-events-none h-full w-full object-cover" />
              </button>
            ) : (
              <img src={line.photoUrl} alt="" className="h-full w-full object-cover" />
            )
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted/30">
              <Package className="size-5 text-muted-foreground" aria-hidden />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-foreground">{line.productName}</p>
          <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground">{line.choiceDetail}</p>
          <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[10px]">
            <span className="text-muted-foreground">
              Qté <strong className="tabular-nums text-foreground">{line.qty}</strong>
              <span className="mx-1">·</span>
              PU{" "}
              <strong className={cn("tabular-nums", productRequestTheme.price)}>
                {line.unitPriceMad != null && Number.isFinite(line.unitPriceMad)
                  ? `${line.unitPriceMad.toFixed(2)} MAD`
                  : "—"}
              </strong>
            </span>
            <span className="shrink-0 font-semibold tabular-nums text-sky-900">
              Tot · {line.lineTotalMad != null ? `${line.lineTotalMad.toFixed(2)} MAD` : "—"}
            </span>
          </div>
          {line.bucket === "order" && line.etaLabel ? (
            <p className="mt-0.5 text-[9px] font-medium text-teal-900">Réception · {line.etaLabel}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function PatientProductRequestActions({
  requestId,
  status,
  items,
  initialPlannedVisitDate,
  initialPlannedVisitTime,
  onReload,
  pharmacyContact = null,
  requestPublicRef = null,
  supplyAmendmentBundles = [],
  requestTimelineMeta = undefined,
  dossierHistoryRows = [],
  pharmacyId = null,
  requestUpdatedAt = null,
  requestType = "product_request",
  prescriptionPaths = null,
  prescriptionNote = null,
  summaryInPageChrome = false,
  detailStale = null,
  archiveTerminalOldStatus = null,
  productPatientNote = null,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const kindConfig = getRequestKindConfig(requestType);
  const workflowCopy = kindConfig.copy.workflow;
  const accent = kindConfig.theme.accent;
  const { config: pricingConfig, resolve: resolveCatalogPrice } = usePharmacyPricingForPatient(pharmacyId ?? undefined);

  const resolveItemCatalogPrice = useCallback(
    (row: ActionItemRow) => {
      const prod = one(row.products);
      return resolveCatalogPrice(
        productEmbedToPricingInput(
          prod
            ? {
                product_type: prod.product_type ?? "parapharmacie",
                price_pph: prod.price_pph,
                price_ppv: prod.price_ppv,
                laboratory: prod.laboratory,
              }
            : null,
          row.product_id
        )
      );
    },
    [resolveCatalogPrice]
  );

  const resolveCatalogUnitPriceForProduct = useCallback(
    (productId: string, embed: { product_type?: string | null; price_pph?: number | null; price_ppv?: number | null; laboratory?: string | null } | null) =>
      resolveCatalogPrice(
        productEmbedToPricingInput(
          embed
            ? {
                product_type: embed.product_type ?? "parapharmacie",
                price_pph: embed.price_pph,
                price_ppv: embed.price_ppv,
                laboratory: embed.laboratory,
              }
            : null,
          productId
        )
      ),
    [resolveCatalogPrice]
  );
  const isPrescription = requestType === "prescription";
  const isConsultation = requestType === "free_consultation";
  const [actionError, setActionError] = useState("");
  const [historyModalItemId, setHistoryModalItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon" | "visit">("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [confirmReviewSnap, setConfirmReviewSnap] = useState<PatientConfirmReviewSnapshot | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitModalNonce, setExitModalNonce] = useState(0);
  const [exitModalMode, setExitModalMode] = useState<RequestExitModalMode>("patient_abandon");
  const [productPhotoPreview, setProductPhotoPreview] = useState<{ url: string; title: string } | null>(null);
  const openProductPhotoPreview = useCallback((url: string, title: string) => {
    if (!url.trim()) return;
    setProductPhotoPreview({ url: url.trim(), title: title.trim() || "Produit" });
  }, []);
  const [prescriptionEditMode, setPrescriptionEditMode] = useState(false);
  const [prescriptionPanelBusy, setPrescriptionPanelBusy] = useState(false);
  const [prescriptionPanelCanSave, setPrescriptionPanelCanSave] = useState(false);
  const prescriptionPanelRef = useRef<PatientPrescriptionPanelHandle>(null);
  const onPrescriptionPanelFooterState = useCallback((state: { busy: boolean; canSave: boolean }) => {
    setPrescriptionPanelBusy(state.busy);
    setPrescriptionPanelCanSave(state.canSave);
  }, []);

  /** Lignes `pharmacist_proposed` masquées tant que statut submitted / in_review — elles sont un brouillon coté officine. */
  const itemsFilteredPending = useMemo(
    () => visibleItemsForPatientBeforePharmacyResponse(items, status),
    [items, status]
  );

  /** Confirmation responded -> confirmed — reset via parent `key` when server rows change */
  const [sel, setSel] = useState(() => computeSelFromItems(items));

  /** Créneau de passage officine (`''` = défaut automatique borne min) */
  const [visitDate, setVisitDate] = useState(initialPlannedVisitDate ?? "");
  const [visitHour, setVisitHour] = useState(() => splitVisitHm(initialPlannedVisitTime).h);
  const [visitMinute, setVisitMinute] = useState(() => splitVisitHm(initialPlannedVisitTime).m);

  const visitSyncKey = `${initialPlannedVisitDate ?? ""}|${initialPlannedVisitTime ?? ""}`;
  const [prevVisitSyncKey, setPrevVisitSyncKey] = useState(visitSyncKey);
  if (visitSyncKey !== prevVisitSyncKey) {
    setPrevVisitSyncKey(visitSyncKey);
    setVisitDate(initialPlannedVisitDate ?? "");
    const hm = splitVisitHm(initialPlannedVisitTime);
    setVisitHour(hm.h);
    setVisitMinute(hm.m);
  }

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ProductHit[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [confirmedRevalidationMode, setConfirmedRevalidationMode] = useState(false);
  const [confirmReviewMode, setConfirmReviewMode] = useState<"initial" | "revalidation">("initial");
  const [resubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);
  const [shouldRestoreFromCatalogue] = useState(() =>
    requestId ? peekPatientDemandeCatalogueReturnEdit(requestId) : false
  );
  const [catalogueRestoreDone, setCatalogueRestoreDone] = useState(false);

  const serverResubmitLines = useMemo(
    () =>
      computeResubmitLinesFromItems(
        visibleItemsForPatientBeforePharmacyResponse(items, status),
        resolveItemCatalogPrice
      ),
    [items, status, resolveItemCatalogPrice]
  );
  const linesSyncKey = editMode
    ? "edit"
    : serverResubmitLines.map((l) => `${l.product_id}:${l.qty}:${l.client_comment}`).join("|");
  const [prevLinesSyncKey, setPrevLinesSyncKey] = useState(linesSyncKey);
  const [lines, setLines] = useState<ResubmitLine[]>(serverResubmitLines);
  if (!editMode && linesSyncKey !== prevLinesSyncKey) {
    setPrevLinesSyncKey(linesSyncKey);
    setLines(serverResubmitLines);
  }

  if (shouldRestoreFromCatalogue && !catalogueRestoreDone && pharmacyId && requestId) {
    clearPatientDemandeCatalogueReturnEdit(requestId);
    setCatalogueRestoreDone(true);
    setEditMode(true);
    setPrevLinesSyncKey("edit");
    const draft = readPatientDemandeProduitsDraft(pharmacyId, requestId);
    if (draft.length > 0) {
      setLines(
        draft.map((d) => {
          const srv = serverResubmitLines.find((s) => s.product_id === d.product_id);
          return resubmitLineFromDraftAndServer(
            d,
            srv,
            resolveItemCatalogPrice,
            visibleItemsForPatientBeforePharmacyResponse(items, status)
          );
        })
      );
    }
  }

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    const fromCatalogue = prevPathname.includes("/demande-produits/catalogue");
    setPrevPathname(pathname);
    if (
      fromCatalogue &&
      editMode &&
      pharmacyId &&
      requestId &&
      pathname.endsWith(`/dashboard/demandes/${requestId}`)
    ) {
      setPrevLinesSyncKey("edit");
      const draft = readPatientDemandeProduitsDraft(pharmacyId, requestId);
      if (draft.length > 0) {
        setLines(
          draft.map((d) => {
            const srv = serverResubmitLines.find((s) => s.product_id === d.product_id);
            return resubmitLineFromDraftAndServer(
              d,
              srv,
              resolveItemCatalogPrice,
              visibleItemsForPatientBeforePharmacyResponse(items, status)
            );
          })
        );
      }
    }
  }

  /** Restaure le brouillon resubmit à l'état initial (sortie du mode édition sans renvoi). */
  const resetResubmitDraft = () => {
    if (requestId) clearPatientDemandeCatalogueReturnEdit(requestId);
    if (pharmacyId) clearPatientDemandeProduitsDraft(pharmacyId, requestId);
    setLines(
      computeResubmitLinesFromItems(
        visibleItemsForPatientBeforePharmacyResponse(items, status),
        resolveItemCatalogPrice
      )
    );
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  const visitWin = useMemo(() => {
    const linesPayload = itemsFilteredPending.map((row) => {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      let branch: LineBranch = null;
      let capPositive = false;

      if (status === "confirmed" || status === "treated") {
        if (!row.is_selected_by_patient) {
          branch = null;
          capPositive = false;
        } else if (row.patient_chosen_alternative_id) {
          branch = row.patient_chosen_alternative_id;
          capPositive = maxQtyForBranch(row, branch, alts) > 0;
        } else {
          branch = "principal";
          capPositive = maxQtyPrincipal(row) > 0;
        }
      } else {
        const st = sel[row.id] ?? emptyLineSelState();
        branch = st.branch;
        capPositive = st.branch !== null && maxQtyForBranch(row, st.branch, alts) > 0;
      }

      return {
        capPositive,
        branch,
        principalAvail: row.availability_status,
        principalEta: row.expected_availability_date ?? null,
        alternatives: alts.map((a) => ({
          id: a.id,
          availability_status: a.availability_status,
          expected_availability_date: a.expected_availability_date ?? null,
        })),
      };
    });
    return plannedVisitWindow(linesPayload);
  }, [itemsFilteredPending, sel, status]);

  const resolvedVisitDate = useMemo(() => {
    const t = visitDate.trim();
    if (t === "") return visitWin.minYmd;
    return clampVisitYmd(t, visitWin.minYmd, visitWin.maxYmd);
  }, [visitDate, visitWin.minYmd, visitWin.maxYmd]);

  const visitTimeComposed = useMemo(() => {
    const h = visitHour.trim();
    const m = visitMinute.trim();
    if (h === "" && m === "") return "";
    const hi = Math.min(23, Math.max(0, Number.parseInt(h, 10) || 0));
    const mi = Math.min(59, Math.max(0, Number.parseInt(m, 10) || 0));
    return `${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }, [visitHour, visitMinute]);

  const baselineResolvedVisitDate = useMemo(() => {
    const raw = (initialPlannedVisitDate ?? "").trim();
    if (raw !== "") return clampVisitYmd(raw, visitWin.minYmd, visitWin.maxYmd);
    return visitWin.minYmd;
  }, [initialPlannedVisitDate, visitWin.minYmd, visitWin.maxYmd]);

  const baselineVisitTimeComposed = useMemo(() => {
    const { h, m } = splitVisitHm(initialPlannedVisitTime);
    const hci = h.trim();
    const mci = m.trim();
    if (hci === "" && mci === "") return "";
    const hi = Math.min(23, Math.max(0, Number.parseInt(hci, 10) || 0));
    const mi = Math.min(59, Math.max(0, Number.parseInt(mci, 10) || 0));
    return `${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }, [initialPlannedVisitTime]);

  const visitPassageDirty = useMemo(
    () =>
      resolvedVisitDate !== baselineResolvedVisitDate || visitTimeComposed !== baselineVisitTimeComposed,
    [resolvedVisitDate, baselineResolvedVisitDate, visitTimeComposed, baselineVisitTimeComposed]
  );

  const historyModalRow = useMemo(
    () => (historyModalItemId ? items.find((r) => r.id === historyModalItemId) ?? null : null),
    [historyModalItemId, items]
  );

  const historyModalBlocks = useMemo((): PatientLineTimelineBlockFr[] => {
    if (!historyModalRow || !requestTimelineMeta?.created_at) return [];
    return buildPatientLineTimelineFr({
      row: historyModalRow,
      requestCreatedAt: requestTimelineMeta.created_at,
      requestSubmittedAt: requestTimelineMeta.submitted_at,
      requestRespondedAt: requestTimelineMeta.responded_at,
      requestConfirmedAt: requestTimelineMeta.confirmed_at,
      requestStatus: status,
      supplyBundles: supplyAmendmentBundles,
      dossierHistory: dossierHistoryRows,
      pharmacistProposedOriginLabel: workflowCopy.timelinePharmacistProposedOrigin,
      patientLineOriginLabel: workflowCopy.patientLineOriginLabel,
    });
  }, [
    historyModalRow,
    requestTimelineMeta,
    status,
    supplyAmendmentBundles,
    dossierHistoryRows,
    workflowCopy.timelinePharmacistProposedOrigin,
    workflowCopy.patientLineOriginLabel,
  ]);

  const visibleHits = useMemo(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) return [];
    return filterCatalogHitsExcludingProductIds(hits, productIdsFromLineProductIds(lines));
  }, [debouncedQuery, hits, lines]);
  const resubmitTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (resubmitLineUnitPrice(l) ?? 0) * l.qty, 0),
    [lines]
  );

  const confirmSelectionSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    if (status !== "responded") return { count, total };
    for (const row of items) {
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const st = sel[row.id];
      if (!st || st.branch === null) continue;
      const cap = maxQtyForBranch(row, st.branch, alts);
      if (cap < 1) continue;
      count += 1;
      const effQty = Math.min(lineSelQtyForBranch(st, st.branch!, cap), cap);
      const branchPrice =
        st.branch === "principal"
          ? (row.unit_price ?? resolveItemCatalogPrice(row))
          : (() => {
              const alt = alts.find((a) => a.id === st.branch);
              if (!alt) return null;
              const altProd = one(alt.products);
              return alt.unit_price ?? resolveCatalogUnitPriceForProduct(alt.product_id, altProd);
            })();
      if (branchPrice != null && Number.isFinite(Number(branchPrice))) {
        total += Number(branchPrice) * effQty;
      }
    }
    return { count, total };
  }, [status, items, sel, resolveItemCatalogPrice, resolveCatalogUnitPriceForProduct]);

  useEffect(() => {
    if (debouncedQuery.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        const sanitized = sanitizeProductSearchQuery(debouncedQuery);
        if (sanitized.length < PRODUCT_CATALOG_SEARCH_MIN_CHARS) {
          setHits([]);
          return;
        }
        const { data, error } = await supabase
          .from("products")
          .select("id,name,product_type,laboratory,photo_url,price_pph,price_ppv")
          .eq("is_active", true)
          .or(productNameOrLaboratoryIlikeOr(sanitized))
          .order("name")
          .limit(PRODUCT_CATALOG_SEARCH_LIMIT);
        if (error || !Array.isArray(data)) {
          setHits([]);
          return;
        }
        setHits(
          (data as ProductHit[]).map((p) => ({
            ...p,
            photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          }))
        );
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [debouncedQuery]);

  const addProduct = (p: ProductHit) => {
    setLines((prev) => {
      if (prev.some((l) => l.product_id === p.id)) return prev;
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          qty: 1,
          unit_price: resolveCatalogPrice(catalogHitToPricingInput(p)),
          client_comment: "",
          line_source: "patient_request",
          pharmacist_proposal_reason: null,
        },
      ];
    });
    setQuery("");
    setHits([]);
    setActionError("");
  };

  const setLineBranch = (itemId: string, branch: LineBranch) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const prev = s[itemId] ?? emptyLineSelState();
      const browseQty = { ...prev.browseQty };
      if (prev.branch !== null) {
        browseQty[lineBranchKey(prev.branch)] = prev.qty;
      }
      if (branch === null) {
        return { ...s, [itemId]: { ...prev, branch: null, browseQty } };
      }
      const cap = maxQtyForBranch(row, branch, alts);
      const key = lineBranchKey(branch);
      const stored = browseQty[key];
      const qty =
        stored != null
          ? Math.min(Math.max(1, stored), cap)
          : cap > 0
            ? cap
            : 1;
      browseQty[key] = qty;
      return {
        ...s,
        [itemId]: { branch, qty, browseQty },
      };
    });
  };

  const setLineQty = (itemId: string, qty: number, forBranch: Exclude<LineBranch, null>) => {
    const row = items.find((i) => i.id === itemId);
    if (!row) return;
    const alts = normalizeAlternatives(row.request_item_alternatives);
    const cap = maxQtyForBranch(row, forBranch, alts);
    if (cap < 1) return;
    const clamped = Math.min(Math.max(1, qty), cap);
    setSel((s) => {
      const prev = s[itemId] ?? emptyLineSelState();
      const key = lineBranchKey(forBranch);
      const browseQty = { ...prev.browseQty, [key]: clamped };
      const isRetained = prev.branch === forBranch;
      return {
        ...s,
        [itemId]: {
          ...prev,
          browseQty,
          ...(isRetained ? { qty: clamped } : {}),
        },
      };
    });
  };

  const toggleLineRetention = (
    itemId: string,
    on: boolean,
    branchWhenOn: Exclude<LineBranch, null>
  ) => {
    setSel((s) => {
      const row = items.find((i) => i.id === itemId);
      if (!row) return s;
      const alts = normalizeAlternatives(row.request_item_alternatives);
      const prev = s[itemId] ?? emptyLineSelState();
      if (!on) {
        const browseQty = { ...prev.browseQty };
        if (prev.branch !== null) browseQty[lineBranchKey(prev.branch)] = prev.qty;
        return { ...s, [itemId]: { ...prev, branch: null, browseQty } };
      }
      const cap = maxQtyForBranch(row, branchWhenOn, alts);
      if (cap < 1) {
        return { ...s, [itemId]: { ...prev, branch: null } };
      }
      const key = lineBranchKey(branchWhenOn);
      const stored = prev.browseQty[key];
      const qty =
        stored != null
          ? Math.min(Math.max(1, stored), cap)
          : Math.min(Math.max(1, prev.qty), cap);
      const browseQty = { ...prev.browseQty, [key]: qty };
      return {
        ...s,
        [itemId]: {
          branch: branchWhenOn,
          qty,
          browseQty,
        },
      };
    });
  };

  const closeConfirmReview = useCallback(() => {
    setConfirmReviewOpen(false);
    setConfirmReviewSnap(null);
  }, []);

  const openConfirmReview = useCallback(() => {
    setConfirmReviewMode("initial");
    const built = buildPatientConfirmSelection(items, sel, requestType, supplyAmendmentBundles);
    const err = validatePatientConfirmBeforeReview(items, sel, built.rpcPayload, visitWin, resolvedVisitDate, visitDate);
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    const timePg = htmlTimeToPg(visitTimeComposed);
    const skippedLines = buildNonRetainedConfirmLines(items, sel, requestType, supplyAmendmentBundles);
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      skippedLines,
      plannedVisitDate: resolvedVisitDate,
      plannedVisitTimePg: timePg,
      visitSummaryFr: formatPlannedVisitFr(resolvedVisitDate, timePg ?? null),
    });
    setConfirmReviewOpen(true);
  }, [items, sel, requestType, supplyAmendmentBundles, visitWin, resolvedVisitDate, visitDate, visitTimeComposed]);

  const openConfirmedRevalidationReview = useCallback(() => {
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    setConfirmReviewMode("revalidation");
    const built = buildPatientConfirmSelection(items, sel, requestType, supplyAmendmentBundles);
    const err = validatePatientConfirmBeforeReview(
      items,
      sel,
      built.rpcPayload,
      visitWin,
      resolvedVisitDate,
      resolvedVisitDate
    );
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    const skippedLines = buildNonRetainedConfirmLines(items, sel, requestType, supplyAmendmentBundles);
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      skippedLines,
      plannedVisitDate: resolvedVisitDate,
      plannedVisitTimePg: htmlTimeToPg(visitTimeComposed),
      visitSummaryFr: formatPlannedVisitFr(resolvedVisitDate, htmlTimeToPg(visitTimeComposed) ?? null),
    });
    setConfirmReviewOpen(true);
  }, [
    items,
    sel,
    requestType,
    supplyAmendmentBundles,
    visitWin,
    resolvedVisitDate,
    visitTimeComposed,
    detailStale,
  ]);

  const startConfirmedRevalidation = useCallback(() => {
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    setConfirmedRevalidationMode(true);
    setSel(computeSelFromConfirmedItems(items));
    setActionError("");
  }, [items, detailStale]);

  const cancelConfirmedRevalidation = useCallback(() => {
    setConfirmedRevalidationMode(false);
    setSel(computeSelFromConfirmedItems(items));
    setActionError("");
  }, [items]);

  useEffect(() => {
    if (!confirmReviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirmReview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReviewOpen, closeConfirmReview]);

  useEffect(() => {
    if (!confirmReviewOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmReviewOpen]);

  const performConfirmAfterReview = async () => {
    if (!confirmReviewSnap) return;
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    setActionError("");
    setBusyAction("confirm");
    const selections = confirmReviewSnap.rpcPayload.map((p) => ({
      request_item_id: p.request_item_id,
      is_selected: p.is_selected,
      selected_qty: p.selected_qty,
      chosen_alternative_id: p.chosen_alternative_id,
    }));
    const { error } =
      confirmReviewMode === "revalidation"
        ? await supabase.rpc("patient_update_confirmation", {
            p_request_id: requestId,
            p_selections: selections,
            p_expected_updated_at: requestUpdatedAt,
          })
        : await supabase.rpc("patient_confirm_after_response", {
            p_request_id: requestId,
            p_selections: selections,
            p_planned_visit_date: confirmReviewSnap.plannedVisitDate,
            p_planned_visit_time: confirmReviewSnap.plannedVisitTimePg,
          });
    setBusyAction("");
    if (error) {
      const msg = error.message ?? "";
      if (/modifié entre-temps|Actualisez la page/i.test(msg)) {
        setActionError(msg);
      } else if (/selected_qty out of range|Quantité invalide pour cette ligne/i.test(msg)) {
        setActionError(
          "La quantité dépasse ce que la pharmacie a proposé pour une alternative. Diminuez la quantité (vous ne pouvez pas l’augmenter au-delà de l’offre)."
        );
      } else {
        setActionError(msg);
      }
      return;
    }
    closeConfirmReview();
    setConfirmedRevalidationMode(false);
    await onReload();
  };

  const validateResubmitLines = (): string | null => {
    if (lines.length === 0) return "Ajoute au moins un produit à la liste.";
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) return "Chaque produit ne peut apparaître qu’une seule fois dans ta liste.";
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) return "Les quantités doivent être entre 1 et 10 pour chaque produit.";
    }
    return null;
  };

  const executeResubmit = async () => {
    setActionError("");

    const p_items = lines.map((l) => {
      const cc = l.client_comment.trim().slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX);
      return {
        product_id: l.product_id,
        requested_qty: l.qty,
        ...(cc.length > 0 ? { client_comment: cc } : {}),
      };
    });
    setBusyAction("resubmit");
    const { error } = await supabase.rpc("patient_resubmit_product_request_after_response", {
      p_request_id: requestId,
      p_patient_note: null,
      p_items,
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    setResubmitConfirmOpen(false);
    if (requestId) clearPatientDemandeCatalogueReturnEdit(requestId);
    if (pharmacyId) clearPatientDemandeProduitsDraft(pharmacyId, requestId);
    setEditMode(false);
    await onReload();
  };

  const openResubmitConfirm = () => {
    const err = validateResubmitLines();
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    setResubmitConfirmOpen(true);
  };

  const handlePatientExitConfirm = async (p: {
    kind: "patient";
    code: PatientCancelReasonCode;
    other: string | null;
  }) => {
    setActionError("");
    setBusyAction("abandon");
    try {
      if (exitModalMode === "patient_before_response") {
        const { error } = await supabase.rpc("patient_cancel_product_request_before_response", {
          p_request_id: requestId,
          p_reason_code: p.code,
          p_reason_other: p.other,
        });
        if (error) {
          setActionError(error.message);
          return;
        }
      } else {
        const { error } = await supabase.rpc("patient_abandon_request", {
          p_request_id: requestId,
          p_reason_code: p.code,
          p_reason_other: p.other,
        });
        if (error) {
          setActionError(error.message);
          return;
        }
      }
      setExitModalOpen(false);
      await onReload();
    } finally {
      setBusyAction("");
    }
  };

  const runUpdateVisit = async () => {
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    setActionError("");
    const rawVisit = visitDate.trim();
    if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
      setActionError(
        visitWin.hasToOrder
          ? `Date hors plage autorisée (jusqu’au ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} inclus selon les produits à commander).`
          : `Date hors plage : au plus tard le ${new Date(visitWin.maxYmd + "T12:00:00").toLocaleDateString("fr-FR")} (4 jours).`
      );
      return;
    }
    setBusyAction("visit");
    const { error } = await supabase.rpc("patient_update_planned_visit_after_confirmation", {
      p_request_id: requestId,
      p_planned_visit_date: resolvedVisitDate,
      p_planned_visit_time: htmlTimeToPg(visitTimeComposed),
    });
    setBusyAction("");
    if (error) {
      setActionError(error.message);
      return;
    }
    await onReload();
  };

  const totalsRetained = useMemo(
    () => monetaryTotalsForRetainedLines(items, status, pricingConfig),
    [items, status, pricingConfig]
  );
  const totalRetainedGrandLabel = useMemo(
    () =>
      compactTotalMadLabel({
        sumKnown: totalsRetained.sumKnown,
        missingPrice: totalsRetained.missingPrice,
        empty: totalsRetained.count < 1,
      }),
    [totalsRetained]
  );

  const resubmitBaseline = useMemo(
    () =>
      computeResubmitLinesFromItems(
        visibleItemsForPatientBeforePharmacyResponse(items, status),
        resolveItemCatalogPrice
      ),
    [items, status]
  );
  const resubmitDirty = useMemo(() => {
    if (status !== "submitted" && status !== "in_review") return false;
    return resubmitLinesSignature(lines) !== resubmitLinesSignature(resubmitBaseline);
  }, [status, lines, resubmitBaseline]);

  const readOnlyArchive = isPatientProductArchiveStatus(status);
  const archiveSnapshotStatus = readOnlyArchive
    ? inferArchiveSnapshotStatus(status, {
        responded_at: requestTimelineMeta?.responded_at,
        confirmed_at: requestTimelineMeta?.confirmed_at,
        items,
        terminalTransitionOldStatus: archiveTerminalOldStatus,
      })
    : null;
  const uiStatus = archiveSnapshotStatus ?? status;
  const forceReadOnly = readOnlyArchive;
  const isTreatedActiveView = status === "treated" && !forceReadOnly;
  const showArchivePassageLine =
    readOnlyArchive && (uiStatus === "confirmed" || uiStatus === "treated");
  const plannedVisitDateYmd = useMemo(
    () => (initialPlannedVisitDate ?? "").trim() || resolvedVisitDate,
    [initialPlannedVisitDate, resolvedVisitDate]
  );
  const plannedVisitTimePg = useMemo(
    () =>
      visitTimeComposed.trim() !== ""
        ? htmlTimeToPg(visitTimeComposed)
        : (initialPlannedVisitTime ?? null),
    [visitTimeComposed, initialPlannedVisitTime]
  );

  const treatedPassageLine = useMemo(() => {
    if (!isTreatedActiveView) return "";
    return patientPlannedVisitPassageLineFr(plannedVisitDateYmd, plannedVisitTimePg);
  }, [isTreatedActiveView, plannedVisitDateYmd, plannedVisitTimePg]);

  const archivePassageFootnote = useMemo(() => {
    if (!showArchivePassageLine) return null;
    return patientArchiveLastPlannedVisitFootnoteFr(plannedVisitDateYmd, plannedVisitTimePg);
  }, [showArchivePassageLine, plannedVisitDateYmd, plannedVisitTimePg]);

  const archiveSel = useMemo(() => {
    if (!readOnlyArchive) return {} as Record<string, LineSelState>;
    if (uiStatus === "confirmed" || uiStatus === "treated") {
      return computeSelFromConfirmedItems(items);
    }
    return computeSelFromItems(items);
  }, [readOnlyArchive, uiStatus, items]);
  const interactiveAllowed =
    !readOnlyArchive &&
    (status === "submitted" ||
      status === "in_review" ||
      status === "responded" ||
      status === "confirmed" ||
      status === "treated");
  const productPhotoPreviewModal = (
    <PatientProductPhotoPreviewModal
      open={productPhotoPreview !== null}
      imageUrl={productPhotoPreview?.url ?? null}
      title={productPhotoPreview?.title ?? ""}
      onClose={() => setProductPhotoPreview(null)}
    />
  );
  const showConfirmedCards = uiStatus === "confirmed" || uiStatus === "treated";
  const latestSupplyAmendmentNotice =
    showConfirmedCards ? patientLatestSupplyAmendmentNoticeFr(supplyAmendmentBundles) : null;

  if (!interactiveAllowed && !readOnlyArchive) return null;

  const badgeDefaults = {
    ordonnance: workflowCopy.pharmacistOrdonnanceLineBadge ?? "Ordonnance",
    proposed: PRESCRIPTION_ADDITIONAL_PROPOSED_REASON,
    officine: pharmacistProposedProductBadgeFr,
  };
  const badgeForRow = (row: ActionItemRow): string | undefined => {
    if (requestType === "prescription") {
      return (
        patientPrescriptionLineBadge(requestType, row, supplyAmendmentBundles) ??
        patientLineProposedBadgeLabel(requestType, row, supplyAmendmentBundles, badgeDefaults) ??
        undefined
      );
    }
    return patientLineProposedBadgeLabel(requestType, row, supplyAmendmentBundles, badgeDefaults) ?? undefined;
  };

  const showConfirm = uiStatus === "responded";
  const canPatientRevalidateConfirmation =
    uiStatus === "confirmed" && !forceReadOnly && requestType === "product_request";
  const showProductResubmit =
    !forceReadOnly &&
    !isPrescription &&
    !isConsultation &&
    (uiStatus === "submitted" || uiStatus === "in_review");
  const showConsultationWaiting =
    isConsultation && (uiStatus === "submitted" || uiStatus === "in_review");
  const showPrescriptionWaiting =
    isPrescription && (uiStatus === "submitted" || uiStatus === "in_review") && prescriptionPaths?.page1;
  const showWaitingShell = showProductResubmit || showPrescriptionWaiting || showConsultationWaiting;
  const showPatientExitCTA =
    !forceReadOnly &&
    !showPrescriptionWaiting &&
    (status === "submitted" ||
      status === "in_review" ||
      status === "responded" ||
      status === "confirmed" ||
      status === "treated");
  const patientExitPrimaryLabel =
    status === "submitted" || status === "in_review"
      ? workflowCopy.patientCancelWhileWaitingLabel
      : "Abandonner la demande";
  const needsStickyFooterPad =
    showProductResubmit ||
    (showPrescriptionWaiting && !forceReadOnly) ||
    ((showConfirm || showConfirmedCards) && !forceReadOnly);

  const stickyFooterPadTier: StickyFooterPadTier = !needsStickyFooterPad
    ? "none"
    : showProductResubmit && editMode
      ? "tall"
      : showPrescriptionWaiting && prescriptionEditMode
        ? "tall"
        : "standard";
  /** Date/heure de passage : à la validation (responded) et pour modifier après coup. */
  const showVisitFields = (showConfirm || showConfirmedCards) && !forceReadOnly;
  const visitFieldsEditable = showVisitFields && !forceReadOnly;

  const visitTimeFr = visitTimeComposed ? formatTime24hFr(htmlTimeToPg(visitTimeComposed) ?? visitTimeComposed) : "";

  const dossierRefLabel = requestPublicRef?.trim() || `Dossier ${requestId.slice(0, 8)}…`;

  const confirmReserveLines =
    confirmReviewSnap?.preview.filter((l) => l.bucket === "reserve") ?? [];
  const confirmOrderLines = confirmReviewSnap?.preview.filter((l) => l.bucket === "order") ?? [];
  const confirmAllPreviewLines = confirmReviewSnap?.preview ?? [];
  const confirmSkippedLines = confirmReviewSnap?.skippedLines ?? [];

  const useSkyProductShell =
    !isConsultation &&
    (showConfirm || showConfirmedCards || showProductResubmit) &&
    !forceReadOnly;
  const useArchiveShell = forceReadOnly && !isConsultation && requestType === "product_request";
  const isExpiredProductArchive = status === "expired" && requestType === "product_request";
  const isCancelledProductArchive = status === "cancelled" && requestType === "product_request";
  const isAbandonedProductArchive = status === "abandoned" && requestType === "product_request";
  const isClosedProductArchive =
    isPatientProductClosedArchiveStatus(status) && requestType === "product_request";
  const isDossierTerminalArchive =
    isExpiredProductArchive ||
    isCancelledProductArchive ||
    isAbandonedProductArchive ||
    isClosedProductArchive;
  const isResubmitDraftArchive =
    isExpiredProductArchive || isCancelledProductArchive || isAbandonedProductArchive;
  const terminalHistoryEntry = isDossierTerminalArchive
    ? findTerminalStatusHistoryEntry(dossierHistoryRows, status)
    : null;
  const archiveDossierStatusLabel = isExpiredProductArchive
    ? "expired"
    : isCancelledProductArchive
      ? "cancelled"
      : isAbandonedProductArchive
        ? "abandoned"
        : isClosedProductArchive
          ? status
          : uiStatus;
  const archiveDossierStatusHint = isExpiredProductArchive
    ? patientExpiredDossierStatusHintShortFr()
    : isCancelledProductArchive
      ? patientCancelledDossierStatusHintShortFr()
      : isAbandonedProductArchive
        ? patientAbandonedDossierStatusHintShortFr()
        : isClosedProductArchive
          ? patientClosedDossierStatusHintShortFr({ terminalStatus: status, items })
          : "Archive — consultation seule.";
  const archiveDossierStatusDetail = isExpiredProductArchive
    ? patientExpiredDossierStatusHintFr({
        expiredAt: terminalHistoryEntry?.created_at ?? null,
        expiresAt: requestTimelineMeta?.expires_at ?? null,
        respondedAt: requestTimelineMeta?.responded_at ?? null,
      })
    : isCancelledProductArchive
      ? patientCancelledDossierStatusHintFr(terminalHistoryEntry)
      : isAbandonedProductArchive
        ? patientAbandonedDossierStatusHintFr(terminalHistoryEntry)
        : isClosedProductArchive
          ? patientClosedDossierStatusHintFr({
              terminalStatus: status,
              items,
              historyEntry: terminalHistoryEntry,
            })
          : "Archive — consultation seule, aucune modification possible.";

  const openArchiveResubmitDraft = () => {
    if (!pharmacyId) return;
    clearPatientDemandeProduitsDraft(pharmacyId);
    writePatientDemandeProduitsDraft(
      pharmacyId,
      buildPatientDemandeProduitsDraftFromArchiveRequest(items)
    );
    const note = productPatientNote?.trim();
    if (note) writePatientDemandeProduitsNote(pharmacyId, note);
    router.push(`/pharmacie/${pharmacyId}/demande-produits`);
  };

  const stickyFooterObscured =
    confirmReviewOpen ||
    resubmitConfirmOpen ||
    exitModalOpen ||
    historyModalItemId !== null;

  return (
    <section
      className={clsx(
        "touch-pan-y w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
        isConsultation ? "mt-0" : "mt-2",
        isConsultation
          ? "border-violet-200/80 bg-gradient-to-b from-violet-50/40 via-white to-fuchsia-50/15"
          : useArchiveShell
            ? "border-slate-200/90 bg-slate-50/75 ring-1 ring-slate-200/65"
            : useSkyProductShell
              ? "border-sky-300/45 bg-gradient-to-br from-sky-50/95 via-white to-teal-50/25 ring-1 ring-sky-200/55"
              : "border-slate-200 bg-slate-50/95",
        stickyFooterPadClass(stickyFooterPadTier),
        isConsultation && showConsultationWaiting && !needsStickyFooterPad && "pb-2"
      )}
    >
      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {latestSupplyAmendmentNotice && !forceReadOnly ? (
        <PatientPharmaUpdateBanner whenLabel={latestSupplyAmendmentNotice.whenLabel} bundles={supplyAmendmentBundles} />
      ) : null}

      {showConsultationWaiting && items.length === 0 ? (
        <p className="mb-2 rounded-lg border border-violet-200/70 bg-white/80 px-2.5 py-2 text-[11px] leading-snug text-violet-950">
          La pharmacie n&apos;a pas encore proposé de produit. Consultez l&apos;onglet <strong>Conversation</strong> pour
          échanger.
        </p>
      ) : null}

      {(showWaitingShell || showConfirm || showConfirmedCards || useArchiveShell) &&
      pharmacyId &&
      !summaryInPageChrome &&
      !forceReadOnly ? (
        showProductResubmit || showConfirm || showConfirmedCards ? (
          <PatientProductRequestDossierHeader
            dossierRefLabel={dossierRefLabel}
            pharmacyContact={pharmacyContact ?? null}
            pharmacyId={pharmacyId}
            status={showConfirm ? "responded" : status}
            statusHint={buildPatientSummaryStatusHint(showConfirm ? "responded" : status, requestType, workflowCopy)}
            statusDetail={buildPatientSummaryStatusDetail(showConfirm ? "responded" : status, requestType, workflowCopy)}
          />
        ) : (
          <PatientSentEnvoyeeSummaryCard
            pharmacyContact={pharmacyContact}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
            lineCount={items.length}
            lineCountLabel={buildPatientLineCountLabel(
              requestType,
              showConfirm ? "responded" : status,
              items.length
            )}
            status={status}
            createdAt={requestTimelineMeta?.created_at ?? ""}
            updatedAt={requestUpdatedAt ?? requestTimelineMeta?.created_at ?? ""}
            kindLabel={workflowCopy.patientSummaryKindLabel}
            refShort={workflowCopy.patientSummaryRefShort}
            statusHint={buildPatientSummaryStatusHint(status, requestType, workflowCopy)}
            accent={accent}
          />
        )
      ) : null}

      {useArchiveShell && pharmacyId ? (
        <PatientProductRequestDossierHeader
          dossierRefLabel={dossierRefLabel}
          pharmacyContact={pharmacyContact ?? null}
          pharmacyId={pharmacyId}
          status={isDossierTerminalArchive ? archiveDossierStatusLabel : uiStatus}
          statusHint={archiveDossierStatusHint}
          statusDetail={archiveDossierStatusDetail}
        />
      ) : null}

      {isClosedProductArchive && pharmacyId ? (
        <div className="mt-3 rounded-xl border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 px-3 py-3 text-center shadow-sm ring-1 ring-emerald-100/80">
          <p className="text-sm font-bold text-emerald-950">Merci pour votre confiance</p>
          <p className="mt-1.5 text-[11px] leading-snug text-emerald-900/90">
            Votre officine a clos ce dossier. Nous espérons que votre passage s&apos;est bien passé et vous accueillir
            à nouveau bientôt.
          </p>
        </div>
      ) : null}

      {isResubmitDraftArchive && pharmacyId ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={openArchiveResubmitDraft}
            className={clsx(
              "w-full rounded-lg px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition",
              isCancelledProductArchive && "bg-rose-700 hover:bg-rose-800",
              isAbandonedProductArchive && "bg-orange-700 hover:bg-orange-800",
              isExpiredProductArchive && "bg-amber-700 hover:bg-amber-800"
            )}
          >
            Ajuster et renvoyer une nouvelle demande
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">
            Ouvre une nouvelle demande chez cette officine avec vos produits préremplis — vous validez l&apos;envoi sur
            la page suivante.
          </p>
        </div>
      ) : null}

      {isTreatedActiveView && treatedPassageLine ? (
        <p
          className="mt-2 rounded-lg border-2 border-sky-400/55 bg-gradient-to-r from-sky-50 via-white to-sky-50/80 px-3 py-2.5 text-center text-[13px] font-semibold leading-snug text-sky-950 shadow-sm ring-1 ring-sky-200/60 sm:text-sm"
          role="status"
        >
          {treatedPassageLine}
        </p>
      ) : null}

      {showPrescriptionWaiting && prescriptionPaths ? (
        <PatientPrescriptionEditablePanel
          ref={prescriptionPanelRef}
          requestId={requestId}
          status={forceReadOnly ? "in_review" : uiStatus}
          paths={prescriptionPaths}
          patientNote={prescriptionNote}
          onReload={onReload}
          editMode={prescriptionEditMode}
          onEditModeChange={setPrescriptionEditMode}
          onFooterStateChange={onPrescriptionPanelFooterState}
        />
      ) : null}

      {forceReadOnly && isConsultation ? (
        <p className="mt-2 rounded-lg border border-violet-200/80 bg-violet-50/50 px-3 py-2 text-[11px] font-medium text-violet-950">
          Dossier {requestStatusFr[status] ?? status} — consultation en lecture seule.
        </p>
      ) : null}

      {isPrescription && prescriptionPaths?.page1 && (showConfirm || showConfirmedCards) ? (
        <PrescriptionScanCollapsible
          paths={prescriptionPaths}
          defaultOpen={false}
          className="mb-2"
          prescriptionNote={prescriptionNote}
        />
      ) : null}

      {forceReadOnly && archiveSnapshotStatus && requestType === "product_request" && !isConsultation ? (
        <>
          <PatientArchiveFrozenProductsView
            snapshotStatus={archiveSnapshotStatus}
            terminalStatus={status}
            items={items}
            archiveSel={archiveSel}
            productsSectionTitle={workflowCopy.patientProductsSectionTitle}
            badgeForRow={badgeForRow}
            requestType={requestType}
            supplyAmendmentBundles={supplyAmendmentBundles}
            pricingConfig={pricingConfig}
            onOpenLineHistory={setHistoryModalItemId}
            onPhotoPreview={openProductPhotoPreview}
            pharmacistProposedBadgeLabel={workflowCopy.patientProposedBadge}
            resolveCatalogUnitPriceForProduct={resolveCatalogUnitPriceForProduct}
          />
          {archivePassageFootnote ? (
            <p className="mt-4 border-t border-slate-200/80 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              <span className="block">{archivePassageFootnote.label}</span>
              {archivePassageFootnote.relative ? (
                <span className="mt-0.5 block text-[10px] text-slate-500/90">({archivePassageFootnote.relative})</span>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}

      {showConfirm && !forceReadOnly ? (
        <div className="mt-4 space-y-3">
          {items.length > 0 ? (
            <section className="space-y-3">
              <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {workflowCopy.patientProductsSectionTitle}
              </h3>
              {(() => {
                const respondedBuckets = bucketPatientRespondedLines(
                  items,
                  requestType,
                  supplyAmendmentBundles
                );
                const renderRespondedLine = (row: ActionItemRow) => (
                  <RespondedPatientLineChooser
                    key={row.id}
                    row={row}
                    selState={sel[row.id] ?? emptyLineSelState()}
                    setLineBranch={setLineBranch}
                    setLineQty={setLineQty}
                    toggleLineRetention={toggleLineRetention}
                    onPhotoPreview={openProductPhotoPreview}
                    pharmacistProposedBadgeLabel={badgeForRow(row) ?? "Ajout Officine"}
                    requestType={requestType}
                    supplyAmendmentBundles={supplyAmendmentBundles}
                    resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
                  />
                );
                return (
                  <div className="space-y-4">
                    {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
                      const rows = respondedBuckets[bucketId];
                      if (rows.length === 0) return null;
                      return (
                        <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length}>
                          <ul className="w-full min-w-0 space-y-2.5 overflow-visible">
                            {rows.map((row) => renderRespondedLine(row))}
                          </ul>
                        </PatientRespondedBucketSection>
                      );
                    })}
                  </div>
                );
              })()}
            </section>
          ) : null}
        </div>
      ) : null}

      {showConfirmedCards && !forceReadOnly ? (
        (() => {
          if (confirmedRevalidationMode && status === "confirmed") {
            return (
              <section className="mt-4 space-y-2.5">
                <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Modifier ma validation
                </h3>
                <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">
                  Tant que la pharmacie n&apos;a pas déclaré la demande traitée, vous pouvez ajuster vos choix (quantités,
                  alternatives).
                </p>
                <ul className="w-full min-w-0 space-y-2.5 overflow-visible">
                  {items.map((row) => (
                    <RespondedPatientLineChooser
                      key={row.id}
                      row={row}
                      selState={sel[row.id] ?? emptyLineSelState()}
                      setLineBranch={setLineBranch}
                      setLineQty={setLineQty}
                      toggleLineRetention={toggleLineRetention}
                      onPhotoPreview={openProductPhotoPreview}
                      pharmacistProposedBadgeLabel={badgeForRow(row) ?? "Ajout Officine"}
                      requestType={requestType}
                      supplyAmendmentBundles={supplyAmendmentBundles}
                      resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
                    />
                  ))}
                </ul>
              </section>
            );
          }

          const { dispoOfficine, aCommander, horsPerimetre, retireesApresValidation } =
            bucketPatientValidatedLinesThreeWays(items);
          const dispoRetenues = dispoOfficine.filter((r) => r.is_selected_by_patient);
          const aCommanderRetenues = aCommander.filter((r) => r.is_selected_by_patient);
          const horsPerimetreRetenues = horsPerimetre.filter((r) => r.is_selected_by_patient);
          const lignesNonRetenues = items.filter((r) => !r.is_selected_by_patient);
          const subtotalDispo = monetaryTotalsForRetainedLines(dispoRetenues, status);
          const subtotalCommande = monetaryTotalsForRetainedLines(aCommanderRetenues, status);
          const isTreatedProductsView = status === "treated";

          return (
            <section className="space-y-3">
              <h3 className="mt-2 px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {workflowCopy.patientProductsSectionTitle}
              </h3>
              {dispoRetenues.length > 0 ? (
                <section className="space-y-2 rounded-xl border-2 border-sky-300/90 bg-sky-50/35 p-2 ring-1 ring-sky-200/60">
                  <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto px-0.5 text-sky-950">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Package className="size-4 shrink-0 text-sky-700" aria-hidden />
                      <h4
                        className={clsx(
                          "min-w-0 font-extrabold uppercase tracking-wide text-sky-950",
                          isTreatedProductsView
                            ? "text-[10px] leading-snug sm:text-[11px]"
                            : "text-[11px]"
                        )}
                      >
                        {isTreatedProductsView
                          ? "Produits réservés pour vous et en attente de votre passage"
                          : `À réserver · ${dispoRetenues.length}`}
                      </h4>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-sky-800">
                      {compactTotalMadLabel({
                        sumKnown: subtotalDispo.sumKnown,
                        missingPrice: subtotalDispo.missingPrice,
                        empty: subtotalDispo.count < 1,
                      })}
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {dispoRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="dispo_officine"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        requestStatusForCard={isTreatedProductsView ? "treated" : status}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={badgeForRow(row) ?? workflowCopy.patientProposedBadge}
                        requestType={requestType}
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        pricingConfig={pricingConfig}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {aCommanderRetenues.length > 0 ? (
                <section className="space-y-2 rounded-xl border-2 border-teal-400/85 bg-teal-50/40 p-2 ring-1 ring-teal-200/65">
                  <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto px-0.5 text-teal-950">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <ShoppingCart className="size-4 shrink-0 text-teal-800" aria-hidden />
                      <h4
                        className={clsx(
                          "min-w-0 font-extrabold uppercase tracking-wide text-teal-950",
                          isTreatedProductsView
                            ? "text-[10px] leading-snug sm:text-[11px]"
                            : "text-[11px]"
                        )}
                      >
                        {isTreatedProductsView
                          ? "Produits commandés pour vous"
                          : `À commander · ${aCommanderRetenues.length}`}
                      </h4>
                    </div>
                    <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-teal-900">
                      {compactTotalMadLabel({
                        sumKnown: subtotalCommande.sumKnown,
                        missingPrice: subtotalCommande.missingPrice,
                        empty: subtotalCommande.count < 1,
                      })}
                    </p>
                  </div>
                  <ul className="space-y-2.5">
                    {aCommanderRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="commande"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        requestStatusForCard={isTreatedProductsView ? "treated" : status}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={badgeForRow(row) ?? workflowCopy.patientProposedBadge}
                        requestType={requestType}
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        pricingConfig={pricingConfig}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {horsPerimetreRetenues.length > 0 ? (
                <section className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/25 p-2 ring-1 ring-amber-100/60">
                  <div className="flex items-center gap-1.5 px-0.5 text-amber-950">
                    <Layers className="size-4 shrink-0 text-amber-800" aria-hidden />
                    <h4 className="text-[11px] font-extrabold uppercase tracking-wide">Point d&apos;attention</h4>
                  </div>
                  <p className="px-0.5 text-[9px] leading-snug text-muted-foreground">
                    À confirmer avec l&apos;officine si besoin.
                  </p>
                  <ul className="space-y-2.5">
                    {horsPerimetreRetenues.map((row) => (
                      <PatientValidatedCompactLineCard
                        key={row.id}
                        row={row}
                        tier="hors_perimetre"
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        requestStatusForCard={status}
                        onPhotoPreview={openProductPhotoPreview}
                        pharmacistProposedBadgeLabel={badgeForRow(row) ?? workflowCopy.patientProposedBadge}
                        requestType={requestType}
                        supplyAmendmentBundles={supplyAmendmentBundles}
                        pricingConfig={pricingConfig}
                      />
                    ))}
                  </ul>
                </section>
              ) : null}

              {retireesApresValidation.length > 0 ? (
                <details className="group rounded-xl border border-red-200/85 bg-red-50/30 ring-1 ring-red-100/70">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-red-950 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <Layers className="size-4 shrink-0 text-red-700" aria-hidden />
                      <span className="text-[11px] font-extrabold uppercase tracking-wide">
                        Écart après validation · {retireesApresValidation.length}
                      </span>
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-red-700 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="space-y-2 border-t border-red-200/70 px-2.5 pb-2.5 pt-2">
                    <p className="text-[9px] leading-snug text-red-900/85">
                      Retrait convenu avec la pharmacie — trace uniquement.
                    </p>
                    <ul className="space-y-2.5">
                      {retireesApresValidation.map((row) => (
                        <PatientValidatedCompactLineCard
                          key={row.id}
                          row={row}
                          tier="retire_apres_validation"
                          onOpenHistory={() => setHistoryModalItemId(row.id)}
                          requestStatusForCard={status}
                          onPhotoPreview={openProductPhotoPreview}
                          pharmacistProposedBadgeLabel={badgeForRow(row) ?? workflowCopy.patientProposedBadge}
                          requestType={requestType}
                          supplyAmendmentBundles={supplyAmendmentBundles}
                          pricingConfig={pricingConfig}
                        />
                      ))}
                    </ul>
                  </div>
                </details>
              ) : null}

              {lignesNonRetenues.length > 0 ? (
                <details className="group rounded-lg border border-sky-200/60 bg-sky-50/25">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[10px] font-semibold text-sky-950 [&::-webkit-details-marker]:hidden">
                    <span>Lignes non retenues ({lignesNonRetenues.length})</span>
                    <ChevronDown className="size-3.5 shrink-0 text-sky-700 transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className="space-y-2 border-t border-sky-200/50 px-2.5 py-2">
                    {lignesNonRetenues.map((row) => (
                      <PatientTraceNotRetainedRow
                        key={row.id}
                        row={row}
                        requestType={requestType}
                        onOpenHistory={() => setHistoryModalItemId(row.id)}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
          );
        })()
      ) : null}

      {showProductResubmit ? (
        <section className="mt-4 w-full min-w-0 max-w-full space-y-2">
          <h3 className="px-0.5 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {workflowCopy.patientProductsSectionTitle}
          </h3>
          {editMode && pharmacyId ? (
            <ProductRequestSearchExplorerRow
              query={query}
              onQueryChange={setQuery}
              fieldFocus={productRequestTheme.focus}
              explorerHref={`/pharmacie/${pharmacyId}/demande-produits/catalogue?requestId=${encodeURIComponent(requestId)}&returnTo=${encodeURIComponent(`/dashboard/demandes/${requestId}`)}`}
              onExplorerNavigate={() =>
                writePatientDemandeProduitsDraft(
                  pharmacyId,
                  lines.map((l) => ({
                    product_id: l.product_id,
                    name: l.name,
                    photo_url: l.photo_url ?? null,
                    qty: l.qty,
                    unit_price: resubmitLineUnitPrice(l),
                    client_comment: l.client_comment,
                  })),
                  requestId
                )
              }
              searchSlot={
                <>
                  {visibleHits.length > 0 ? (
                    <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                      {visibleHits.map((h) => (
                        <ProductRequestCatalogHitRow
                          key={h.id}
                          hit={{
                            id: h.id,
                            name: h.name,
                            photo_url: h.photo_url ?? null,
                            unitPrice: resolveCatalogPrice(catalogHitToPricingInput(h)),
                          }}
                          onAdd={() => addProduct(h)}
                          onPhotoPreview={() => {
                            if (h.photo_url) openProductPhotoPreview(h.photo_url, h.name);
                          }}
                        />
                      ))}
                    </ul>
                  ) : query.trim().length >= 2 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Aucun résultat.</p>
                  ) : null}
                </>
              }
            />
          ) : null}
          <ul className="w-full min-w-0 max-w-full space-y-1.5 overflow-visible">
            {lines.map((l, idx) => (
              <PatientProductRequestCompactLine
                key={`${l.product_id}-${idx}`}
                line={{
                  product_id: l.product_id,
                  name: l.name,
                  photo_url: l.photo_url,
                  qty: l.qty,
                  client_comment: l.client_comment,
                  line_source: l.line_source,
                  pharmacist_proposal_reason: l.pharmacist_proposal_reason,
                }}
                unitPrice={resubmitLineUnitPrice(l)}
                editMode={editMode}
                onRemove={editMode ? () => setLines((prev) => prev.filter((_, i) => i !== idx)) : undefined}
                onPhotoPreview={() => {
                  if (l.photo_url) openProductPhotoPreview(l.photo_url, l.name);
                }}
                onSetQty={(qty) =>
                  setLines((prev) =>
                    prev.map((row, i) => (i === idx ? { ...row, qty: Math.min(10, Math.max(1, qty)) } : row))
                  )
                }
                onSaveComment={
                  editMode
                    ? (comment) =>
                        setLines((prev) =>
                          prev.map((row, i) =>
                            i === idx
                              ? {
                                  ...row,
                                  client_comment: comment.slice(0, PATIENT_PRODUCT_LINE_COMMENT_MAX),
                                }
                              : row
                          )
                        )
                    : undefined
                }
                notesSlot={
                  !editMode ? (
                    <PatientSentLineNotesModalFr
                      productName={l.name}
                      client={l.client_comment ?? ""}
                      pharmacist={l.pharmacist_comment ?? ""}
                    />
                  ) : undefined
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-2 space-y-2">
        {showVisitFields ? (
          <div
            className={clsx(
              "rounded-xl border-2 p-2.5 shadow-md sm:p-3",
              visitFieldsEditable
                ? "border-primary/35 bg-gradient-to-br from-primary/[0.12] via-background to-primary/[0.06] ring-1 ring-primary/25"
                : "border-slate-200/90 bg-slate-50/80 ring-1 ring-slate-200/50"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={clsx(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg shadow-sm ring-1",
                  visitFieldsEditable
                    ? "bg-primary/15 text-primary ring-primary/20"
                    : "bg-slate-200/80 text-slate-600 ring-slate-200/80"
                )}
              >
                <Calendar className="size-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                  Date de passage {showConfirm && visitFieldsEditable ? (
                    <span className="text-destructive">*</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                  {visitFieldsEditable
                    ? "Indique quand tu prévois de passer à l'officine."
                    : "Consultation seule — ce dossier n'accepte plus de modification."}
                </p>
              </div>
            </div>
            <label className="mt-2.5 block text-[11px] font-semibold text-foreground">
              <span className="sr-only">Date</span>
              <input
                type="date"
                min={visitWin.minYmd}
                max={visitWin.maxYmd}
                value={resolvedVisitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                disabled={!visitFieldsEditable}
                readOnly={!visitFieldsEditable}
                className="mt-1 block w-full rounded-lg border-2 border-input bg-background px-2 py-2 text-[13px] font-semibold tabular-nums shadow-inner disabled:cursor-default disabled:opacity-90"
                required={showConfirm && visitFieldsEditable}
              />
            </label>
            <div className="mt-2">
              <PlannedVisitTimeInput
                hour={visitHour}
                minute={visitMinute}
                onHourChange={setVisitHour}
                onMinuteChange={setVisitMinute}
                disabled={!visitFieldsEditable}
              />
            </div>
            {visitTimeFr ? (
              <span className="mt-2 block text-[10px] font-medium text-muted-foreground">Enregistré : {visitTimeFr}</span>
            ) : null}
            {visitFieldsEditable && showConfirmedCards && status === "confirmed" ? (
              <p className="mt-2 text-[10px] leading-snug text-primary/90">
                La pharmacie voit les changements sur la demande.
              </p>
            ) : visitFieldsEditable && isTreatedActiveView ? (
              <p className="mt-2 text-[10px] leading-snug text-sky-900/85">
                La pharmacie est informée si vous modifiez votre passage (bouton en bas de l&apos;écran).
              </p>
            ) : visitFieldsEditable && showConfirm ? (
              <p className="mt-2 text-[10px] leading-snug text-sky-900/85">
                Ces informations seront transmises avec ta validation.
              </p>
            ) : null}
          </div>
        ) : null}

        {(showConfirm || showConfirmedCards) ? (
          pharmacyContact ? (
            <div className="mt-2">
              <PatientPharmacyQuickContact pharmacy={pharmacyContact} requestRef={dossierRefLabel} />
            </div>
          ) : (
            <section className="mt-2 rounded-xl border border-sky-200/65 bg-muted/25 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              {showConfirmedCards
                ? "Après validation, les changements passent par votre pharmacie."
                : "Les coordonnées de l’officine seront affichées ici lorsqu’elles sont disponibles."}
            </section>
          )
        ) : null}

        {showConfirm || showConfirmedCards ? (
          !isConsultation ? (
            <p className="mt-3 rounded-lg border border-sky-200/70 bg-white/90 px-2.5 py-2 text-[10px] leading-snug text-sky-950 shadow-sm">
              Pour échanger avec la pharmacie à tout moment, utilise le bouton{" "}
              <strong className="font-semibold">Conversation</strong> en bas à droite de l&apos;écran.
            </p>
          ) : null
        ) : null}

        {showPatientExitCTA ? (
          <div
            className={clsx(
              "mt-4 border-t border-rose-200/50 pt-3",
              showConfirm && !showProductResubmit && "mb-24",
              showConfirmedCards && "mb-32"
            )}
          >
            {canPatientRevalidateConfirmation && !confirmedRevalidationMode ? (
              <button
                type="button"
                disabled={busyAction !== "" || Boolean(detailStale)}
                onClick={startConfirmedRevalidation}
                className="mx-auto mb-3 flex min-h-[2.75rem] min-w-[min(100%,14rem)] max-w-md items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
              >
                <Pencil size={16} aria-hidden />
                Modifier ma validation
              </button>
            ) : null}
            <button
              type="button"
              disabled={busyAction !== ""}
              onClick={() => {
                setExitModalNonce((n) => n + 1);
                setExitModalMode(
                  status === "submitted" || status === "in_review"
                    ? "patient_before_response"
                    : "patient_abandon"
                );
                setExitModalOpen(true);
              }}
              className="mx-auto flex min-h-[2.75rem] min-w-[min(100%,14rem)] max-w-md items-center justify-center rounded-lg border border-rose-300/70 bg-rose-50/80 px-4 py-2.5 text-sm font-semibold text-rose-950 shadow-sm hover:bg-rose-100/90 disabled:opacity-50"
            >
              {patientExitPrimaryLabel}
            </button>
            <RequestExitConfirmModalFr
              key={exitModalNonce}
              open={exitModalOpen}
              mode={exitModalMode}
              busy={busyAction === "abandon"}
              onClose={() => {
                if (busyAction === "abandon") return;
                setExitModalOpen(false);
              }}
              onConfirmPatient={handlePatientExitConfirm}
            />
          </div>
        ) : null}
      </div>

      {showProductResubmit && !stickyFooterObscured ? (
        <PlatformStickyFooter tone="slate">
          <div className="flex flex-col gap-2">
            <PlatformStickyFooterSummaryRow
              left={
                <>
                  <span className="font-bold tabular-nums text-foreground">{lines.length}</span>{" "}
                  produit{lines.length > 1 ? "s" : ""}
                </>
              }
              right={formatPriceDh(resubmitTotal)}
            />
            {!editMode ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setEditMode(true);
                  }}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-3 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                >
                  <Pencil size={16} aria-hidden />
                  Modifier
                </button>
                {resubmitDirty ? (
                  <button
                    type="button"
                    disabled={busyAction !== "" || lines.length === 0}
                    onClick={() => openResubmitConfirm()}
                    className="h-9 w-full rounded-md border border-amber-600 bg-amber-600/95 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                  >
                    {busyAction === "resubmit" ? "Envoi…" : "Renvoyer à la pharmacie"}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    resetResubmitDraft();
                    setEditMode(false);
                  }}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300/90 bg-white px-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler les changements
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || !resubmitDirty || lines.length === 0}
                  onClick={() => openResubmitConfirm()}
                  className="h-10 min-w-0 flex-1 rounded-lg bg-primary px-2 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyAction === "resubmit" ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            )}
          </div>
        </PlatformStickyFooter>
      ) : null}

      {showPrescriptionWaiting && !forceReadOnly && !stickyFooterObscured ? (
        <PlatformStickyFooter tone="slate">
          <div className="flex flex-col gap-1.5">
            {!prescriptionEditMode ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.startEdit()}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-500/80 bg-amber-50 px-3 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100/90 disabled:opacity-50"
                >
                  <Pencil size={16} aria-hidden />
                  Modifier
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.openCancelOrdonnance()}
                  className="h-10 w-full rounded-lg border border-rose-300/70 bg-rose-50/80 px-3 text-sm font-semibold text-rose-950 shadow-sm hover:bg-rose-100/90 disabled:opacity-50"
                >
                  {workflowCopy.patientCancelWhileWaitingLabel}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.cancelEdit()}
                  className="h-10 flex-1 rounded-lg border-2 border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy || !prescriptionPanelCanSave}
                  onClick={() => void prescriptionPanelRef.current?.save()}
                  className="h-10 flex-1 rounded-lg border border-amber-600 bg-amber-600/95 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
                >
                  {prescriptionPanelBusy ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            )}
          </div>
        </PlatformStickyFooter>
      ) : null}

      {showConfirm && !forceReadOnly && !stickyFooterObscured ? (
        <PlatformStickyFooter tone="sky">
          <div className="flex flex-col gap-2">
            <PlatformStickyFooterSummaryRow
              left={
                <>
                  <span className="font-bold tabular-nums text-foreground">{confirmSelectionSummary.count}</span>{" "}
                  {confirmSelectionSummary.count > 1 ? "lignes retenues" : "ligne retenue"}
                </>
              }
              right={
                confirmSelectionSummary.total > 0
                  ? `${confirmSelectionSummary.total.toFixed(2)} MAD`
                  : "—"
              }
            />
            <button
              type="button"
              disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
              onClick={openConfirmReview}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
            >
              Valider ma demande
            </button>
          </div>
        </PlatformStickyFooter>
      ) : null}

      {showConfirmedCards && !forceReadOnly && !stickyFooterObscured ? (
        <PlatformStickyFooter tone="sky">
          <div className="flex flex-col gap-2">
            {!confirmedRevalidationMode ? (
              <>
                <PlatformStickyFooterSummaryRow
                  left={
                    <>
                      <span className="font-bold tabular-nums text-foreground">{totalsRetained.count}</span>{" "}
                      {totalsRetained.count > 1 ? "produits retenus" : "produit retenu"}
                    </>
                  }
                  right={totalRetainedGrandLabel}
                />
                <button
                  type="button"
                  disabled={busyAction !== "" || !visitPassageDirty || Boolean(detailStale)}
                  onClick={() => void runUpdateVisit()}
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
                >
                  {busyAction === "visit" ? "Mise à jour…" : "Mettre à jour ma date de passage"}
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={cancelConfirmedRevalidation}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300/90 bg-white px-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler les changements
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || Boolean(detailStale)}
                  onClick={openConfirmedRevalidationReview}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-amber-600 bg-amber-600/95 px-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyAction === "confirm" ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            )}
          </div>
        </PlatformStickyFooter>
      ) : null}

      {confirmReviewOpen && confirmReviewSnap ? (
        <AppModalOverlay
          open
          aria-labelledby="confirm-review-title"
          className="overflow-y-auto p-2 sm:items-center sm:p-4"
          onBackdropClick={() => {
            if (busyAction !== "confirm") closeConfirmReview();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-review-title"
            className={cn(
              "relative z-10 flex max-h-[min(92dvh,34rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl",
              productRequestTheme.modalShell
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={cn("shrink-0 border-b px-3 py-2.5", productRequestTheme.modalHeader)}>
              <h2 id="confirm-review-title" className="text-center text-sm font-bold leading-snug text-sky-950 sm:text-base">
                {confirmReviewMode === "revalidation" ? "Enregistrer ma validation" : "Confirmer ta sélection"}
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gradient-to-b from-sky-50/20 via-white to-muted/15 px-2.5 py-2.5 sm:px-3 [-webkit-overflow-scrolling:touch]">
              {confirmReviewMode === "initial" ? (
                <div className={cn("rounded-lg border px-2 py-1.5", productRequestTheme.modalHighlight)}>
                  <p className={cn("text-[8px] font-bold uppercase tracking-wide", productRequestTheme.modalLabel)}>
                    Passage
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium leading-snug text-foreground">
                    {confirmReviewSnap.visitSummaryFr}
                  </p>
                </div>
              ) : (
                <p className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-2 py-1.5 text-[11px] leading-snug text-sky-950">
                  Vérifiez vos produits retenus et quantités avant enregistrement.
                </p>
              )}

              {confirmReserveLines.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-sky-200/80 bg-sky-50/80 px-2 py-1">
                    <Package className="size-3.5 shrink-0 text-sky-800" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-wide text-sky-950">À réserver</p>
                  </div>
                  <ul className="space-y-1.5">
                    {confirmReserveLines.map((line) => (
                      <PatientConfirmReviewLineCard
                        key={line.rowId}
                        line={line}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-sky-900/90">
                    {formatBlockSubtotalLabel(confirmReserveLines)}
                  </p>
                </div>
              ) : null}

              {confirmOrderLines.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-teal-200/85 bg-teal-50/70 px-2 py-1">
                    <ShoppingCart className="size-3.5 shrink-0 text-teal-950" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-wide text-teal-950">À commander</p>
                  </div>
                  <ul className="space-y-1.5">
                    {confirmOrderLines.map((line) => (
                      <PatientConfirmReviewLineCard
                        key={line.rowId}
                        line={line}
                        onPhotoPreview={openProductPhotoPreview}
                      />
                    ))}
                  </ul>
                  <p className="mt-2 text-right text-[11px] leading-snug font-medium text-teal-900/88">
                    {formatBlockSubtotalLabel(confirmOrderLines)}
                  </p>
                </div>
              ) : null}

              {confirmSkippedLines.length > 0 ? (
                <div className="mt-3 rounded-lg border border-slate-200/90 bg-slate-50/90 px-2 py-2 ring-1 ring-slate-200/50">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">Non retenus (information)</p>
                  <ul className="mt-1.5 space-y-1">
                    {confirmSkippedLines.map((s) => (
                      <li
                        key={s.rowId}
                        className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-slate-200/70 bg-white/90 px-2 py-1 text-[10px] text-slate-800"
                      >
                        <span className="min-w-0 font-medium leading-snug">{s.productName}</span>
                        {s.skipLabel ? (
                          <span
                            className={clsx(
                              "shrink-0 rounded px-1 py-px text-[8px] font-semibold uppercase",
                              s.skipLabel === "Ordonnance" || s.skipLabel === "Produit proposé par la pharmacie"
                                ? "bg-amber-100 text-amber-950"
                                : "bg-violet-100 text-violet-900"
                            )}
                          >
                            {s.skipLabel}
                          </span>
                        ) : s.isProposed ? (
                          <span className="shrink-0 rounded bg-violet-100 px-1 py-px text-[8px] font-semibold uppercase text-violet-900">
                            Proposition
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] text-muted-foreground">Ta demande</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(() => {
                const grand = blockMonetarySummary(confirmAllPreviewLines);
                return (
                  <div className="mt-4 rounded-xl border-2 border-sky-400/55 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 px-3 py-3 shadow-md ring-2 ring-sky-200/50">
                    <p className="text-center text-[10px] font-bold uppercase tracking-wide text-sky-800">
                      Total de votre sélection
                    </p>
                    <p className="mt-1.5 text-center text-2xl font-bold leading-none tabular-nums text-sky-950 sm:text-[1.65rem]">
                      {grand.missingUnitPrice && grand.sumKnown === 0
                        ? "—"
                        : `${grand.sumKnown.toFixed(2)} MAD`}
                    </p>
                    {grand.missingUnitPrice ? (
                      <p className="mt-1.5 text-center text-[10px] leading-snug text-sky-900/85">
                        Total partiel — certains prix unitaires manquent.
                      </p>
                    ) : null}
                  </div>
                );
              })()}
            </div>

            <div className="shrink-0 border-t border-border/70 bg-background/95 px-2.5 py-2 backdrop-blur sm:px-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-2">
                <button
                  type="button"
                  disabled={busyAction === "confirm" || Boolean(detailStale)}
                  onClick={closeConfirmReview}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground shadow-sm transition hover:bg-muted/60 disabled:opacity-50 sm:order-1 sm:w-auto"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={busyAction === "confirm" || Boolean(detailStale)}
                  onClick={() => void performConfirmAfterReview()}
                  className={cn(
                    "w-full rounded-xl px-3 py-2 text-[12px] font-semibold shadow-sm transition hover:opacity-95 disabled:opacity-50 sm:order-2 sm:w-auto sm:min-w-[180px]",
                    productRequestTheme.cta
                  )}
                >
                  {busyAction === "confirm"
                    ? "Enregistrement…"
                    : confirmReviewMode === "revalidation"
                      ? "Enregistrer ma validation"
                      : "Confirmer définitivement"}
                </button>
              </div>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}

      {showProductResubmit && resubmitConfirmOpen ? (
        <AppModalOverlay
          open
          aria-labelledby="resubmit-confirm-title"
          onBackdropClick={() => {
            if (busyAction !== "resubmit" && !detailStale) setResubmitConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="resubmit-confirm-title"
            className="relative z-10 flex max-h-[min(88dvh,560px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-3 py-2.5 sm:px-4">
              <h2 id="resubmit-confirm-title" className="text-base font-bold leading-tight text-slate-900 sm:text-lg">
                {"Confirmer le renvoi de la liste"}
              </h2>
              <button
                type="button"
                disabled={busyAction === "resubmit" || Boolean(detailStale)}
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
                onClick={() => setResubmitConfirmOpen(false)}
                aria-label="Fermer"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 sm:px-4">
              <p className="text-xs leading-snug text-slate-600">
                {lines.length} produit{lines.length > 1 ? "s" : ""} — les photos viennent du catalogue si disponibles.
              </p>
              <ul className="mt-2 space-y-2">
                {lines.map((l, idx) => (
                  <li
                    key={`${l.product_id}-${idx}`}
                    className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                      {l.photo_url ? (
                        <button
                          type="button"
                          className="relative size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                          onClick={() => openProductPhotoPreview(l.photo_url!, l.name)}
                          aria-label={`Agrandir la photo · ${l.name}`}
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
                          <span className="min-w-0 shrink text-[11px] text-slate-600">
                            <span className="font-semibold text-slate-500">PU</span>{" "}
                            <strong className="whitespace-nowrap tabular-nums text-slate-900">
                              {formatPriceDh(resubmitLineUnitPrice(l))}
                            </strong>
                          </span>
                          <span className="shrink-0 whitespace-nowrap text-[11px] font-bold tabular-nums text-sky-900">
                            <span className="font-semibold text-sky-800/90">Tot</span>{" "}
                            {resubmitLineUnitPrice(l) != null
                          ? formatPriceDh((resubmitLineUnitPrice(l) ?? 0) * l.qty)
                          : "—"}
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
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">TOTAL</span>
                <span className="text-lg font-bold tabular-nums text-sky-900">{formatPriceDh(resubmitTotal)}</span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyAction === "resubmit" || Boolean(detailStale)}
                  onClick={() => setResubmitConfirmOpen(false)}
                  className="h-10 flex-1 rounded-xl border-2 border-slate-300 bg-white text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busyAction === "resubmit" || Boolean(detailStale)}
                  onClick={() => void executeResubmit()}
                  className="h-10 flex-1 rounded-xl bg-amber-600 text-sm font-semibold text-white shadow-md hover:bg-amber-700 disabled:opacity-50"
                >
                  {busyAction === "resubmit" ? "Envoi…" : "Confirmer le renvoi"}
                </button>
              </div>
            </div>
          </div>
        </AppModalOverlay>
      ) : null}

      <LineHistoryModalFr
        open={historyModalItemId !== null}
        title={historyModalRow ? validatedProductLabel(historyModalRow) : ""}
        blocks={historyModalBlocks}
        onClose={() => setHistoryModalItemId(null)}
      />
      {productPhotoPreviewModal}
    </section>
  );
}
