"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { useTranslations } from "next-intl";
import {
  applyTimelinePhaseLabels,
  localizeTimelineAtLabels,
  useTimelinePhaseLabels,
} from "@/lib/i18n/build-patient-timeline";
import { usePatientRequestStatusLabel } from "@/lib/i18n/patient-request-status-label";
import { lineConversationVisual } from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { ProductLinePhotoThumb } from "@/components/products/product-line-photo-thumb";
import { Button } from "@/components/ui/button";
import { AppModalOverlay } from "@/components/ui/app-modal-overlay";
import { cn } from "@/lib/utils";
import {
  uiActionBtnDestructiveWide,
  uiActionBtnFullDestructive,
  uiActionBtnFlexCancel,
  uiActionBtnFlexPrimary,
  uiActionBtnFlexRow,
  uiActionBtnFull,
  uiActionBtnFullOutline,
  uiActionBtnFullSecondary,
  uiActionBtnModalFlexPrimary,
  uiActionBtnModalOutline,
  uiActionBtnModalPrimary,
} from "@/lib/ui-action-buttons";
import { usePatientArchiveClosureLabel } from "@/lib/i18n/patient-archive-closure-label";
import {
  useCompactTotalMadLabel,
  useGrandTotalMadLabel,
  useSubtotalBlockMadLabel,
} from "@/lib/i18n/use-compact-total-mad-label";
import { usePatientDatetimeFormatters } from "@/lib/i18n/use-patient-datetime-formatters";
import { usePatientLineCountLabel } from "@/lib/i18n/use-patient-line-count-label";
import {
  RequestExitConfirmModalFr,
  type RequestExitModalMode,
} from "@/components/requests/request-exit-confirm-modal-fr";
import type { PatientCancelReasonCode } from "@/lib/patient-flow-reasons";
import {
  availabilityStatusFr,
  pharmacistProposedProductBadgeFr,
  requestItemLineSourceFr,
  requestStatusBadgeClass,
  requestStatusFr,
} from "@/lib/request-display";
import { plannedVisitWindow } from "@/lib/planned-visit";
import {
  bucketPatientRespondedLines,
  PATIENT_RESPONDED_BUCKET_ORDER,
} from "@/lib/patient-responded-line-buckets";
import { patientBucketProductListClass } from "@/lib/patient-bucket-product-row-ui";
import {
  hasPatientWorkflowAccentShell,
  isPatientProductRequestType,
  patientLineRowClass,
  patientWorkflowDossierSectionShellClass,
  patientWorkflowLineAccent,
} from "@/lib/patient-product-request-line-ui";
import { PatientRespondedBucketSection } from "@/components/requests/product/patient-responded-bucket-section";
import { PatientValidatedBucketSection } from "@/components/requests/product/patient-validated-bucket-section";
import { PatientClosedArchiveBucketSection } from "@/components/requests/product/patient-closed-archive-bucket-section";
import { PatientArchiveCollapsibleSection } from "@/components/requests/product/patient-archive-collapsible-section";
import { DossierEditModeIndicator } from "@/components/requests/dossier-edit-mode-indicator";
import { DossierInlineActionPanel } from "@/components/requests/dossier-inline-action-panel";
import { dossierEditModeShellClass } from "@/lib/dossier-edit-mode-ui";
import type { StickyFooterTone } from "@/lib/platform-sticky-footer";
import {
  bucketPatientValidatedLinesThreeWays,
  type PatientLineLike,
  validatedBranchDescriptionHtml,
  validatedBranchUnitPriceMad,
  validatedBranchPhotoPath,
  validatedProductBrand,
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
  ProductRequestLineQtyReadonly,
  ProductRequestLinePrices,
  ProductRequestSearchExplorerRow,
} from "@/components/pharmacy/patient-demande-produits-ui";
import { PatientProductRequestDossierHeader } from "@/components/requests/product/patient-product-request-dossier-header";
import { PatientPharmacyDossierBand } from "@/components/requests/product/patient-pharmacy-dossier-band";
import { DossierHeaderRequestLine } from "@/components/requests/shared/dossier-header-sent-at";
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
  patientAbandonedPrescriptionEmptyArchiveDetailFr,
  patientCancelledDossierStatusHintFr,
  patientCancelledDossierStatusHintShortFr,
  patientCancelledPrescriptionEmptyArchiveDetailFr,
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
import { hasPrescriptionScan } from "@/lib/prescription-media";
import { getRequestKindWorkflowCopy } from "@/lib/request-kinds/workflow-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindAccent } from "@/lib/request-kinds/types";
import { productRequestPublicTheme as productRequestTheme } from "@/lib/request-kinds/product-request-public-theme";
import { requestKindUiTheme } from "@/lib/request-kind-ui-theme";
import { archiveClosedQtyLabelFr, validatedOriginFallbackPatientFr } from "@/lib/prescription-ui-copy";
import { usePrescriptionUiCopy } from "@/lib/use-prescription-ui-copy";
import { useRequestKindPatientCopy } from "@/lib/i18n/request-kind-patient-copy";
import { usePatientValidatedLineLabels } from "@/lib/use-patient-validated-line-labels";
import { uiSecondaryLabel } from "@/lib/ui-label-styles";
import {
  PatientProductPhotoPreviewModal,
  type CatalogProductPhotoPreview,
  type ProductPhotoPreviewHandler,
} from "@/components/requests/patient-product-photo-preview-modal";
import { productDescriptionHtmlForDisplay } from "@/lib/product-description-html";
import { PlannedVisitTimeInput } from "@/components/requests/planned-visit-time-input";
import { PlannedVisitDateInput } from "@/components/requests/planned-visit-date-input";
import { PATIENT_PRODUCT_LINE_COMMENT_MAX } from "@/lib/patient-request-form-limits";
import { inferAvailabilityStatusFromQty } from "@/lib/pharmacist-availability";
import { patientMaxQtyAlternative, patientMaxQtyPrincipal } from "@/lib/alternative-qty-rules";
import { PatientLineNotesIconButton } from "@/components/requests/product/patient-line-notes-icon-button";
import {
  validatedLineLabelChipClass,
  validatedOriginLabelFr,
} from "@/lib/patient-validated-line-labels-fr";

type ProdBrief = {
  name: string;
  product_type?: string | null;
  brand?: string | null;
  laboratory?: string | null;
  price_pph?: number | null;
  price_ppv?: number | null;
  photo_url?: string | null;
  full_description?: string | null;
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

/** Vignette validée — même gabarit que demande répondue (~62px). */
const VALIDATED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

function validatedLineRowClass(
  tier: "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation",
  withdrawnGrey: boolean
): string {
  if (withdrawnGrey) {
    return "opacity-75";
  }
  if (tier === "retire_apres_validation") {
    return "opacity-90";
  }
  return "";
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
  onPhotoPreview?: ProductPhotoPreviewHandler;
  pharmacistProposedBadgeLabel?: string;
  requestType?: string;
  supplyAmendmentBundles?: { amendments: unknown }[];
}) {
  const tCommon = useTranslations("common");
  const prescriptionCopy = usePrescriptionUiCopy();
  const defaultOrigins = useMemo(
    () => [prescriptionCopy.validatedOriginFallbackPatient(requestType)].filter(Boolean),
    [prescriptionCopy, requestType],
  );
  const { buildLabels } = usePatientValidatedLineLabels(defaultOrigins);
  const lineKindTheme = requestKindUiTheme(requestType);
  const validatedName = validatedProductLabel(row);
  const validatedBrand = validatedProductBrand(row);
  const descriptionHtml = validatedBranchDescriptionHtml(row);
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
  const lineLabels = buildLabels({
    row,
    originLabel,
    supplyAmendmentBundles,
    archiveClosureLabel,
    treatedLineLabels: requestStatusForCard === "treated",
    sectionBucket: tier,
  });
  const thumbInner = (
    <ProductLinePhotoThumb
      photoUrl={thumbUrl}
      productType={one(row.products)?.product_type}
      productName={validatedName}
      descriptionHtml={descriptionHtml}
      brand={validatedBrand}
      onPhotoPreview={onPhotoPreview}
      ringClassName={lineKindTheme.photoRing}
    />
  );

  return (
    <li className={cn(patientLineRowClass(requestType), validatedLineRowClass(tier, withdrawnGrey))}>
      <div className="flex items-start gap-2.5">
        <div className={cn(VALIDATED_LINE_THUMB, "shrink-0 self-start", withdrawnGrey && "opacity-95")}>
          {thumbInner}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p
            className={cn(
              "line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug",
              withdrawnGrey && "text-muted-foreground line-through decoration-slate-400/90"
            )}
            title={validatedName}
          >
            {validatedName}
          </p>

          <div
            className={cn(
              "flex w-full items-end justify-between gap-3 leading-none",
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
              {hasPatientWorkflowAccentShell(requestType) ? (
                <ProductRequestLineQtyReadonly
                  qty={displayQty}
                  lineAccent={patientWorkflowLineAccent(requestType) ?? "sky"}
                />
              ) : (
                <ProductRequestLineQtyInline qty={displayQty} />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm hover:bg-muted/50"
                aria-label={tCommon("historyLineAria")}
                title={tCommon("history")}
              >
                <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
              <PatientLineNotesIconButton
                productName={validatedName}
                client={row.client_comment ?? ""}
                pharmacist={row.pharmacist_comment ?? ""}
                requestType={requestType}
              />
            </div>
          </div>

          {lineLabels.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {lineLabels.map((label) => (
                <span key={label.key} className={validatedLineLabelChipClass(label)}>
                  {label.text}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
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
  onPhotoPreview?: ProductPhotoPreviewHandler;
  requestType?: string;
}) {
  const tCommon = useTranslations("common");
  const prescriptionCopy = usePrescriptionUiCopy();
  const lineKindTheme = requestKindUiTheme(requestType);
  const prod = one(row.products);
  const name = prod?.name ?? tCommon("product");
  const eff = row.availability_status;
  const statusLabel = eff ? availabilityStatusFr[eff] ?? eff : null;
  const lineKind =
    row.line_source === "pharmacist_proposed" ? (
      requestType === "prescription"
        ? PRESCRIPTION_ADDITIONAL_PROPOSED_REASON
        : requestItemLineSourceFr.pharmacist_proposed
    ) : null;
  const photoUrl = prod?.photo_url ? resolvePublicMediaUrl(prod.photo_url) : null;

  return (
    <li className={patientLineRowClass(requestType)}>
      <div className="flex items-start gap-2.5">
        <div className={cn(VALIDATED_LINE_THUMB, "shrink-0 self-start opacity-90")}>
          <ProductLinePhotoThumb
            photoUrl={photoUrl}
            productType={prod?.product_type}
            productName={name}
            descriptionHtml={prod?.full_description}
            brand={prod?.brand}
            onPhotoPreview={onPhotoPreview}
            ringClassName={lineKindTheme.photoRing}
            className="size-full opacity-90"
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p
            className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug text-muted-foreground line-through decoration-slate-400/90"
            title={name}
          >
            {name}
          </p>

          <div className="flex w-full items-end justify-between gap-3 leading-none">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[10px] text-muted-foreground">
                {prescriptionCopy.archiveClosedQtyLabel(requestType ?? "product_request")}{" "}
                <strong className="tabular-nums text-foreground/80">{row.requested_qty}</strong>
              </span>
              {statusLabel ? (
                <span className="rounded border border-border/80 bg-muted/25 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {statusLabel}
                </span>
              ) : null}
              {lineKind ? (
                <span className="text-[10px] font-medium text-violet-800/90">{lineKind}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm hover:bg-muted/50"
                aria-label={tCommon("historyLineAria")}
                title={tCommon("history")}
              >
                <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
              <PatientLineNotesIconButton
                productName={name}
                client={row.client_comment ?? ""}
                pharmacist={row.pharmacist_comment ?? ""}
                requestType={requestType}
              />
            </div>
          </div>

          {postConfirmBadges && postConfirmBadges.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {postConfirmBadges.map((label) => (
                <span
                  key={label}
                  className="inline-flex max-w-full shrink-0 items-center rounded border border-border/80 bg-muted/25 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide leading-tight text-foreground/85"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Défaut : principal si disponible ; sinon première alternative retenable. */
function pickDefaultBranch(row: ActionItemRow, alts: ActionItemAltRow[]): LineBranch {
  if (maxQtyPrincipal(row) > 0) return "principal";
  if (alts.length > 0) {
    for (const alt of alts) {
      if (maxQtyAlt(row, alt) > 0) return alt.id;
    }
    return null;
  }
  return null;
}

function lineSelMapsEqual(
  a: Record<string, LineSelState>,
  b: Record<string, LineSelState>
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const sa = a[k];
    const sb = b[k];
    if (!sa && !sb) continue;
    if (!sa || !sb) return false;
    if (sa.branch !== sb.branch || sa.qty !== sb.qty) return false;
    const browseKeys = new Set([...Object.keys(sa.browseQty), ...Object.keys(sb.browseQty)]);
    for (const bk of browseKeys) {
      if ((sa.browseQty[bk] ?? null) !== (sb.browseQty[bk] ?? null)) return false;
    }
  }
  return true;
}

export function computeSelFromConfirmedItems(items: ActionItemRow[]): Record<string, LineSelState> {
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

export function computeSelFromItems(items: ActionItemRow[]): Record<string, LineSelState> {
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
  brand?: string | null;
  product_type?: string | null;
  photo_url?: string | null;
  full_description?: string | null;
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
    brand: base.brand ?? srv?.brand ?? (itemRow ? one(itemRow.products)?.brand : null) ?? null,
    product_type:
      base.product_type ?? srv?.product_type ?? (itemRow ? one(itemRow.products)?.product_type : null) ?? null,
    photo_url: base.photo_url,
    full_description:
      base.full_description ?? srv?.full_description ?? (itemRow ? one(itemRow.products)?.full_description : null) ?? null,
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
  resolveCatalog: ((row: ActionItemRow) => number | null) | undefined,
  productFallback: string,
): ResubmitLine[] {
  return items.map((row) => ({
    product_id: row.product_id,
    name: one(row.products)?.name ?? productFallback,
    brand: one(row.products)?.brand ?? null,
    product_type: one(row.products)?.product_type ?? null,
    photo_url: resolvePublicMediaUrl(one(row.products)?.photo_url ?? null),
    full_description: one(row.products)?.full_description ?? null,
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

export type ResubmitLineChange =
  | { kind: "added"; line: ResubmitLine }
  | { kind: "removed"; line: ResubmitLine }
  | {
      kind: "modified";
      line: ResubmitLine;
      qtyBefore?: number;
      qtyAfter?: number;
      commentBefore?: string;
      commentAfter?: string;
    };

function diffResubmitLines(baseline: ResubmitLine[], current: ResubmitLine[]): ResubmitLineChange[] {
  const baseById = new Map(baseline.map((l) => [l.product_id, l]));
  const curById = new Map(current.map((l) => [l.product_id, l]));
  const out: ResubmitLineChange[] = [];

  for (const line of current) {
    const prev = baseById.get(line.product_id);
    if (!prev) {
      out.push({ kind: "added", line });
      continue;
    }
    const qtyChanged = prev.qty !== line.qty;
    const commentChanged = prev.client_comment.trim() !== line.client_comment.trim();
    if (qtyChanged || commentChanged) {
      out.push({
        kind: "modified",
        line,
        qtyBefore: qtyChanged ? prev.qty : undefined,
        qtyAfter: qtyChanged ? line.qty : undefined,
        commentBefore: commentChanged ? prev.client_comment.trim() : undefined,
        commentAfter: commentChanged ? line.client_comment.trim() : undefined,
      });
    }
  }
  for (const line of baseline) {
    if (!curById.has(line.product_id)) out.push({ kind: "removed", line });
  }
  return out;
}

function validatedTierForClosedArchiveRow(row: ActionItemRow): "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation" {
  const { dispoOfficine, aCommander, horsPerimetre } = bucketPatientValidatedLinesThreeWays([row]);
  if (dispoOfficine.some((r) => r.id === row.id)) return "dispo_officine";
  if (aCommander.some((r) => r.id === row.id)) return "commande";
  if (horsPerimetre.some((r) => r.id === row.id)) return "hors_perimetre";
  return row.withdrawn_after_confirm ? "retire_apres_validation" : "dispo_officine";
}

function archiveProductsFrozenSectionShell(title: string, frozenHint: string, children: ReactNode) {
  return (
    <section className="mt-4 w-full min-w-0 space-y-4 px-0">
      <div className="space-y-1">
        <h3 className="pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <p className="text-[10px] leading-snug text-muted-foreground">{frozenHint}</p>
      </div>
      {children}
    </section>
  );
}

function archiveRetainedTotalsFooter(input: {
  count: number;
  countLabel: string;
  totalLabel: string;
}) {
  if (input.count < 1) return null;
  return (
    <div className="flex flex-nowrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-sm font-medium text-muted-foreground">
        <span className="font-bold tabular-nums text-foreground">{input.count}</span> {input.countLabel}
      </p>
      <p className="shrink-0 text-base font-bold tabular-nums text-foreground">{input.totalLabel}</p>
    </div>
  );
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
  onPhotoPreview: ProductPhotoPreviewHandler;
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
  const tCommon = useTranslations("common");
  const tArchiveFooter = useTranslations("demandes.archive.footer");
  const archiveClosureLabel = usePatientArchiveClosureLabel();
  const compactTotalMadLabel = useCompactTotalMadLabel();
  const frozenHint = tArchiveFooter("frozenStateHint");
  const noop = () => {};

  if (snapshotStatus === "submitted" || snapshotStatus === "in_review") {
    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      frozenHint,
      <ul className={patientBucketProductListClass}>
        {items.map((row) => {
          const prod = one(row.products);
          const unit = validatedBranchUnitPriceMad(row, pricingConfig, row.product_id);
          return (
            <PatientProductRequestCompactLine
              key={row.id}
              line={{
                product_id: row.product_id,
                name: prod?.name ?? tCommon("product"),
                product_type: prod?.product_type ?? null,
                photo_url: prod?.photo_url ?? null,
                qty: row.requested_qty,
                client_comment: row.client_comment ?? "",
                line_source: row.line_source,
                pharmacist_proposal_reason: row.pharmacist_proposal_reason,
              }}
              unitPrice={unit}
              editMode={false}
              onPhotoPreview={() => {
                const raw = prod?.photo_url;
                const url = raw ? resolvePublicMediaUrl(raw) ?? raw : null;
                onPhotoPreview(
                  url,
                  prod?.name ?? "Produit",
                  prod?.full_description,
                  prod?.brand,
                  prod?.product_type,
                  { catalogExplorerPreview: !url?.trim() }
                );
              }}
              onSetQty={noop}
            />
          );
        })}
      </ul>
    );
  }

  if (snapshotStatus === "responded") {
    const respondedBuckets = bucketPatientRespondedLines(items, requestType, supplyAmendmentBundles);
    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      frozenHint,
      <div className="w-full min-w-0 space-y-5">
        {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
          const rows = respondedBuckets[bucketId];
          if (rows.length === 0) return null;
          return (
            <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length}>
              <ul className={patientBucketProductListClass}>
                {rows.map((row) => (
                  <RespondedPatientLineChooser
                    key={row.id}
                    row={row}
                    bucketId={bucketId}
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
        archiveClosureLabel={archiveClosureLabel(row)}
        onPhotoPreview={onPhotoPreview}
        pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
        requestType={requestType}
        supplyAmendmentBundles={supplyAmendmentBundles}
        pricingConfig={pricingConfig}
      />
    );

    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      frozenHint,
      <>
        {PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER.map((bucketId) => {
          const rows = closedBuckets[bucketId];
          if (rows.length === 0) return null;

          if (bucketId === "non_retenus" || bucketId === "ecartes") {
            const title =
              bucketId === "non_retenus"
                ? tCommon("notSelected")
                : patientClosedArchiveBucketTitleFr(bucketId);
            return (
              <PatientArchiveCollapsibleSection
                key={bucketId}
                title={title}
                count={rows.length}
                variant={bucketId === "ecartes" ? "attention" : "neutral"}
                hint={
                  bucketId === "ecartes"
                    ? tCommon("notSelectedHint")
                    : undefined
                }
              >
                <ul className={patientBucketProductListClass}>
                  {rows.map((row) =>
                    bucketId === "non_retenus" ? (
                      <PatientTraceNotRetainedRow
                        key={row.id}
                        row={row}
                        requestType={requestType}
                        onOpenHistory={() => onOpenLineHistory(row.id)}
                        onPhotoPreview={onPhotoPreview}
                      />
                    ) : (
                      renderClosedValidatedCard(row)
                    )
                  )}
                </ul>
              </PatientArchiveCollapsibleSection>
            );
          }

          return (
            <PatientClosedArchiveBucketSection
              key={bucketId}
              bucketId={bucketId}
              count={rows.length}
              subtotalLabel={
                bucketId === "recuperes"
                  ? compactTotalMadLabel({
                      sumKnown: pickedUpTotals.sumKnown,
                      missingPrice: pickedUpTotals.missingPrice,
                      empty: pickedUpTotals.count < 1,
                    })
                  : null
              }
            >
              <ul className={patientBucketProductListClass}>
                {rows.map((row) => renderClosedValidatedCard(row))}
              </ul>
            </PatientClosedArchiveBucketSection>
          );
        })}

        {archiveRetainedTotalsFooter({
          count: pickedUpTotals.count,
          countLabel:
          pickedUpTotals.count > 1 ? tCommon("productsPickedUp") : tCommon("productPickedUp"),
          totalLabel: compactTotalMadLabel({
            sumKnown: pickedUpTotals.sumKnown,
            missingPrice: pickedUpTotals.missingPrice,
            empty: pickedUpTotals.count < 1,
          }),
        })}
      </>
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

  return archiveProductsFrozenSectionShell(
    productsSectionTitle,
    frozenHint,
    <>
      {dispoRetenues.length > 0 ? (
        <PatientValidatedBucketSection
          bucketId="dispo_officine"
          count={dispoRetenues.length}
          isTreatedView={isTreatedSnapshot}
          subtotalLabel={compactTotalMadLabel({
            sumKnown: subtotalDispo.sumKnown,
            missingPrice: subtotalDispo.missingPrice,
            empty: subtotalDispo.count < 1,
          })}
        >
          <ul className={patientBucketProductListClass}>
            {dispoRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="dispo_officine"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={archiveClosureLabel(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </PatientValidatedBucketSection>
      ) : null}

      {aCommanderRetenues.length > 0 ? (
        <PatientValidatedBucketSection
          bucketId="commande"
          count={aCommanderRetenues.length}
          isTreatedView={isTreatedSnapshot}
          subtotalLabel={compactTotalMadLabel({
            sumKnown: subtotalCommande.sumKnown,
            missingPrice: subtotalCommande.missingPrice,
            empty: subtotalCommande.count < 1,
          })}
        >
          <ul className={patientBucketProductListClass}>
            {aCommanderRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="commande"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={archiveClosureLabel(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </PatientValidatedBucketSection>
      ) : null}

      {horsPerimetreRetenues.length > 0 ? (
        <PatientValidatedBucketSection bucketId="hors_perimetre" count={horsPerimetreRetenues.length}>
          <ul className={patientBucketProductListClass}>
            {horsPerimetreRetenues.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="hors_perimetre"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={archiveClosureLabel(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </PatientValidatedBucketSection>
      ) : null}

      {retireesApresValidation.length > 0 ? (
        <PatientArchiveCollapsibleSection
          title={tCommon("withdrawalAfterValidation")}
          count={retireesApresValidation.length}
          variant="withdrawn"
          hint={tCommon("withdrawalHint")}
        >
          <ul className={patientBucketProductListClass}>
            {retireesApresValidation.map((row) => (
              <PatientValidatedCompactLineCard
                key={row.id}
                row={row}
                tier="retire_apres_validation"
                onOpenHistory={() => onOpenLineHistory(row.id)}
                requestStatusForCard={cardStatus}
                archiveClosureLabel={archiveClosureLabel(row)}
                onPhotoPreview={onPhotoPreview}
                pharmacistProposedBadgeLabel={badgeForRow(row) ?? pharmacistProposedBadgeLabel}
                requestType={requestType}
                supplyAmendmentBundles={supplyAmendmentBundles}
                pricingConfig={pricingConfig}
              />
            ))}
          </ul>
        </PatientArchiveCollapsibleSection>
      ) : null}

      {lignesNonRetenues.length > 0 ? (
        <PatientArchiveCollapsibleSection title={tCommon("unreleasedLines")} count={lignesNonRetenues.length}>
          <ul className={patientBucketProductListClass}>
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
        </PatientArchiveCollapsibleSection>
      ) : null}

      {archiveRetainedTotalsFooter({
        count: totalsRetained.count,
        countLabel:
          totalsRetained.count > 1 ? tCommon("productsRetained") : tCommon("productRetained"),
        totalLabel: compactTotalMadLabel({
          sumKnown: totalsRetained.sumKnown,
          missingPrice: totalsRetained.missingPrice,
          empty: totalsRetained.count < 1,
        }),
      })}
    </>
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
  const visual = lineConversationVisual(c, p);

  return (
    <>
      <ProductRequestLineMessageIconButton
        visual={visual}
        onClick={() => setOpen(true)}
      />
      <AppModalOverlay open={open} aria-labelledby={titleId} onBackdropClick={() => setOpen(false)}>
        <div
          className={cn(
            "max-h-[min(80vh,20rem)] w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-2xl sm:mx-auto",
            productRequestTheme.modalShell
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={cn("flex items-start justify-between gap-2 border-b px-3 py-2", productRequestTheme.modalHeader)}>
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span className="block">Notes — produit</span>
                <span className="mt-1 block text-[13px] font-semibold normal-case leading-snug text-foreground">
                  {productName}
                </span>
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
      </AppModalOverlay>
    </>
  );
}

function summaryThemeClasses(accent: RequestKindAccent, requestType?: string | null) {
  const sky = isPatientProductRequestType(requestType) || accent === "sky";
  const amber = requestType === "prescription" || accent === "amber";
  const violet = requestType === "free_consultation" || accent === "violet";
  return {
    shell: sky
      ? "mb-2 rounded-lg border border-sky-200/75 bg-sky-50/30 px-2 py-1.5 text-[10px] leading-snug shadow-sm ring-1 ring-sky-100/45 sm:px-2.5"
      : amber
        ? "mb-2 rounded-lg border border-amber-200/50 bg-amber-50/25 px-2 py-1.5 text-[10px] leading-snug shadow-sm ring-1 ring-amber-100/30 sm:px-2.5"
        : violet
          ? "mb-2 rounded-lg border border-violet-200/45 bg-violet-50/20 px-2 py-1.5 text-[10px] leading-snug shadow-sm ring-1 ring-violet-100/30 sm:px-2.5"
          : "mb-2 rounded-lg border border-border bg-muted/25 px-2 py-1.5 text-[10px] leading-snug shadow-sm sm:px-2.5",
    borderB: sky
      ? "border-sky-200/60"
      : amber
        ? "border-amber-200/45"
        : violet
          ? "border-violet-200/40"
          : "border-border",
    borderB2: sky
      ? "border-sky-200/50"
      : amber
        ? "border-amber-200/40"
        : violet
          ? "border-violet-200/35"
          : "border-border/80",
    title: "text-foreground",
    meta: "text-muted-foreground",
    chip: "border-border text-foreground",
    link: "text-primary",
    contactBtn: "border-border text-foreground hover:bg-muted/40",
    contactIcon: "text-muted-foreground",
    contactPanel: "border-border ring-border/60",
    metaRow: "text-foreground",
    metaLabel: "text-muted-foreground",
    hint: "text-foreground",
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
  submittedAt,
  kindLabel: _kindLabel,
  refShort,
  statusHint,
  accent = "sky",
  requestType = "product_request",
}: {
  pharmacyContact: PatientPharmacyContactInfo | null;
  pharmacyId: string;
  dossierRefLabel: string;
  lineCount: number;
  lineCountLabel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  kindLabel: string;
  refShort: string;
  statusHint: string;
  accent?: RequestKindAccent;
  requestType?: string | null;
}) {
  const ph = pharmacyContact;
  const t = summaryThemeClasses(accent, requestType);
  const statusBadgeLabel = usePatientRequestStatusLabel(status);
  return (
    <div className={t.shell}>
      <div className={clsx("border-b pb-1.5", t.borderB)}>
        <DossierHeaderRequestLine
          kindLabel={_kindLabel}
          dossierRefLabel={dossierRefLabel}
          submittedAt={submittedAt}
          createdAt={createdAt}
          className={t.title}
        />
        <div className="mt-1.5">
          <PatientPharmacyDossierBand
            pharmacyContact={ph}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
            requestType={requestType}
            compact
          />
        </div>
      </div>
      <p className={clsx("mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 border-b pb-1.5 text-[9px] tabular-nums", t.borderB2, t.metaRow)}>
        <span className="font-semibold">{lineCountLabel}</span>
      </p>
      <div className="mt-1.5 flex flex-wrap items-start gap-2">
        <span className={clsx("shrink-0 shadow-sm", requestStatusBadgeClass(status))}>
          {statusBadgeLabel}
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
  brand: string | null;
  laboratory: string | null;
  photo_url?: string | null;
  full_description?: string | null;
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

export function usePatientSummaryStatusCopy(requestType: string) {
  const tDemandes = useTranslations("demandes");
  const workflowCopy = useRequestKindPatientCopy(requestType);

  const hint = (status: string): string => {
    if (status === "responded") return tDemandes("statusHints.responded");
    if (status === "confirmed") {
      return requestType === "prescription"
        ? tDemandes("statusHints.confirmedPrescription")
        : tDemandes("statusHints.confirmedDefault");
    }
    if (status === "treated") return tDemandes("statusHints.treated");
    if (status === "in_review") {
      if (requestType === "free_consultation") return workflowCopy.patientWaitingInReviewHint;
      return tDemandes("statusHints.inReview");
    }
    if (status === "submitted" && requestType === "free_consultation") {
      return workflowCopy.patientWaitingSubmittedHint;
    }
    return tDemandes("statusHints.submitted");
  };

  const detail = (status: string): string | null => {
    if (status === "responded") return tDemandes("statusDetails.responded");
    if (status === "confirmed") {
      return requestType === "prescription"
        ? tDemandes("statusDetails.confirmedPrescription")
        : tDemandes("statusDetails.confirmedDefault");
    }
    if (status === "treated") return tDemandes("statusDetails.treated");
    if (status === "in_review") return workflowCopy.patientWaitingInReviewHint;
    return workflowCopy.patientWaitingSubmittedHint;
  };

  return { hint, detail, workflowCopy };
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
  descriptionHtml: string | null;
  brand: string | null;
  productType: string | null;
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

type ConfirmLineCopy = {
  productFallback: string;
  alternativeFallback: string;
  proposalLabel: string;
  pharmacyProposedProduct: string;
};

function buildPatientConfirmSelection(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>,
  requestType: string,
  amendmentBundles: { amendments: unknown }[],
  formatDateShort: (ymd: string | null | undefined) => string,
  copy: ConfirmLineCopy,
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
      let descriptionHtml: string | null = null;
      let brand: string | null = null;
      let productType: string | null = null;

      if (st.branch === "principal") {
        productName = principalProd?.name ?? copy.productFallback;
        brand = principalProd?.brand?.trim() || null;
        productType = principalProd?.product_type?.trim() || null;
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
          eta = formatDateShort(row.expected_availability_date);
        }
        photoUrl = resolvePublicMediaUrl(principalProd?.photo_url ?? null);
        descriptionHtml = productDescriptionHtmlForDisplay(principalProd?.full_description);
      } else {
        const alt = alts.find((a) => a.id === st.branch);
        const altProd = alt ? one(alt.products) : null;
        productName = altProd?.name ?? copy.alternativeFallback;
        brand = altProd?.brand?.trim() || null;
        productType = altProd?.product_type?.trim() || null;
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
          eta = formatDateShort(alt.expected_availability_date);
        }
        photoUrl = resolvePublicMediaUrl(altProd?.photo_url ?? null);
        descriptionHtml = productDescriptionHtmlForDisplay(altProd?.full_description);
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
        descriptionHtml,
        brand,
        productType,
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
  amendmentBundles: { amendments: unknown }[],
  copy: ConfirmLineCopy,
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
        productName: one(row.products)?.name ?? copy.productFallback,
        isProposed: isExtra || (row.line_source === "pharmacist_proposed" && requestType !== "prescription"),
        skipLabel: isRxProp
          ? copy.pharmacyProposedProduct
          : row.line_source === "pharmacist_proposed"
            ? copy.proposalLabel
            : null,
      });
    }
  }
  return out;
}

type PatientConfirmValidationCopy = {
  keepAtLeastOneLine: string;
  qtyExceedsMax: (label: string, cap: number) => string;
  missingEtaOnToOrder: string;
  visitDateRequired: string;
  visitDateOutOfRange: (maxDate: string, hasToOrder: boolean) => string;
};

function validatePatientConfirmBeforeReview(
  items: ActionItemRow[],
  sel: Record<string, LineSelState>,
  rpcPayload: PatientConfirmRpcRow[],
  visitWin: ReturnType<typeof plannedVisitWindow>,
  resolvedVisitDate: string,
  visitDateRaw: string,
  copy: PatientConfirmValidationCopy & Pick<ConfirmLineCopy, "productFallback" | "alternativeFallback">,
  formatMaxVisitDate: (ymd: string) => string
): string | null {
  const anyOn = rpcPayload.some((p) => p.is_selected);
  if (!anyOn) {
    return copy.keepAtLeastOneLine;
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
        st.branch === "principal"
          ? (one(row.products)?.name ?? copy.productFallback)
          : (one(alt?.products)?.name ?? copy.alternativeFallback);
      return copy.qtyExceedsMax(label, cap);
    }
  }
  if (visitWin.missingEtaOnToOrder) {
    return copy.missingEtaOnToOrder;
  }
  const rawVisit = visitDateRaw.trim();
  if (rawVisit === "") {
    return copy.visitDateRequired;
  }
  if (rawVisit !== "" && rawVisit !== resolvedVisitDate) {
    const maxDate = formatMaxVisitDate(visitWin.maxYmd);
    return copy.visitDateOutOfRange(maxDate, visitWin.hasToOrder);
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

function PatientConfirmReviewLineCard({
  line,
  onPhotoPreview,
}: {
  line: PatientConfirmPreviewLine;
  onPhotoPreview?: ProductPhotoPreviewHandler;
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
          <ProductLinePhotoThumb
            photoUrl={line.photoUrl}
            productType={line.productType}
            productName={line.productName}
            descriptionHtml={line.descriptionHtml}
            brand={line.brand}
            onPhotoPreview={onPhotoPreview}
          />
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
  const tCommon = useTranslations("common");
  const tDemandes = useTranslations("demandes");
  const tValidation = useTranslations("demandes.validation");
  const tModal = useTranslations("demandes.modal");
  const dt = usePatientDatetimeFormatters();
  const lineCountLabel = usePatientLineCountLabel();
  const phaseLabels = useTimelinePhaseLabels();
  const prescriptionCopy = usePrescriptionUiCopy();
  const compactTotalMadLabel = useCompactTotalMadLabel();
  const subtotalBlockMadLabel = useSubtotalBlockMadLabel();
  const grandTotalMadLabel = useGrandTotalMadLabel();

  const confirmLineCopy = useMemo<ConfirmLineCopy>(
    () => ({
      productFallback: tCommon("product"),
      alternativeFallback: tCommon("alternative"),
      proposalLabel: tCommon("proposal"),
      pharmacyProposedProduct: prescriptionCopy.pharmacyProposedProduct,
    }),
    [tCommon, prescriptionCopy.pharmacyProposedProduct],
  );

  const formatBlockSubtotalLabel = useCallback(
    (lines: PatientConfirmPreviewLine[]) => {
      if (lines.length === 0) return "";
      const { sumKnown, missingUnitPrice } = blockMonetarySummary(lines);
      return subtotalBlockMadLabel(sumKnown, missingUnitPrice);
    },
    [subtotalBlockMadLabel],
  );

  const formatMaxVisitDate = useCallback((ymd: string) => dt.formatDateShort(ymd), [dt]);

  const validationCopy = useMemo<PatientConfirmValidationCopy>(
    () => ({
      keepAtLeastOneLine: tValidation("keepAtLeastOneLine"),
      qtyExceedsMax: (label, cap) => tValidation("qtyExceedsMax", { label, cap }),
      missingEtaOnToOrder: tValidation("missingEtaOnToOrder"),
      visitDateRequired: tCommon("visitDateRequired"),
      visitDateOutOfRange: (maxDate, hasToOrder) =>
        hasToOrder
          ? tCommon("visitDateOutOfRangeOrder", { maxDate })
          : tCommon("visitDateOutOfRange", { maxDate }),
    }),
    [tValidation, tCommon]
  );
  const { hint: summaryStatusHint, detail: summaryStatusDetail, workflowCopy: i18nWorkflowCopy } =
    usePatientSummaryStatusCopy(requestType);
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
                brand: prod.brand,
              }
            : null,
          row.product_id
        )
      );
    },
    [resolveCatalogPrice]
  );

  const resolveCatalogUnitPriceForProduct = useCallback(
    (productId: string, embed: { product_type?: string | null; price_pph?: number | null; price_ppv?: number | null; brand?: string | null; laboratory?: string | null } | null) =>
      resolveCatalogPrice(
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
      ),
    [resolveCatalogPrice]
  );
  const isPrescription = requestType === "prescription";
  const isConsultation = requestType === "free_consultation";
  const dossierUiTheme = requestKindUiTheme(requestType);
  const [actionError, setActionError] = useState("");
  const [historyModalItemId, setHistoryModalItemId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"" | "confirm" | "resubmit" | "abandon" | "visit">("");
  const [confirmReviewOpen, setConfirmReviewOpen] = useState(false);
  const [confirmReviewSnap, setConfirmReviewSnap] = useState<PatientConfirmReviewSnapshot | null>(null);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitModalNonce, setExitModalNonce] = useState(0);
  const [exitModalMode, setExitModalMode] = useState<RequestExitModalMode>("patient_abandon");
  const [productPhotoPreview, setProductPhotoPreview] = useState<CatalogProductPhotoPreview | null>(null);
  const openProductPhotoPreview = useCallback(
    (
      url: string | null,
      title: string,
      descriptionHtml?: string | null,
      brand?: string | null,
      productType?: string | null,
      options?: { catalogExplorerPreview?: boolean }
    ) => {
      if (!options?.catalogExplorerPreview && !url?.trim()) return;
      setProductPhotoPreview({
        url: url?.trim() || null,
        title: title.trim() || "Produit",
        brand: brand ?? null,
        product_type: productType ?? null,
        descriptionHtml: productDescriptionHtmlForDisplay(descriptionHtml),
        catalogExplorerPreview: options?.catalogExplorerPreview ?? false,
      });
    },
    []
  );
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
  const [confirmedRevalidationBaseline, setConfirmedRevalidationBaseline] = useState<Record<
    string,
    LineSelState
  > | null>(null);
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
        resolveItemCatalogPrice,
        confirmLineCopy.productFallback,
      ),
    [items, status, resolveItemCatalogPrice, confirmLineCopy.productFallback]
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
    const blocks = buildPatientLineTimelineFr({
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
      requestType,
      timelineAudience: "patient",
      locale: dt.locale,
      phaseLabels,
    });
    return applyTimelinePhaseLabels(localizeTimelineAtLabels(blocks, dt.locale), phaseLabels);
  }, [
    historyModalRow,
    requestTimelineMeta,
    status,
    supplyAmendmentBundles,
    dossierHistoryRows,
    workflowCopy.timelinePharmacistProposedOrigin,
    workflowCopy.patientLineOriginLabel,
    requestType,
    dt.locale,
    phaseLabels,
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
          .select("id,name,product_type,brand,laboratory,photo_url,price_pph,price_ppv,full_description")
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
          brand: p.brand,
          product_type: p.product_type,
          photo_url: resolvePublicMediaUrl(p.photo_url ?? null),
          full_description: p.full_description ?? null,
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
    const built = buildPatientConfirmSelection(
      items,
      sel,
      requestType,
      supplyAmendmentBundles,
      dt.formatDateShort,
      confirmLineCopy,
    );
    const err = validatePatientConfirmBeforeReview(
      items,
      sel,
      built.rpcPayload,
      visitWin,
      resolvedVisitDate,
      visitDate,
      { ...validationCopy, ...confirmLineCopy },
      formatMaxVisitDate
    );
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    const timePg = htmlTimeToPg(visitTimeComposed);
    const skippedLines = buildNonRetainedConfirmLines(
      items,
      sel,
      requestType,
      supplyAmendmentBundles,
      confirmLineCopy,
    );
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      skippedLines,
      plannedVisitDate: resolvedVisitDate,
      plannedVisitTimePg: timePg,
      visitSummaryFr: dt.formatPlannedVisit(resolvedVisitDate, timePg ?? null),
    });
    setConfirmReviewOpen(true);
  }, [
    items,
    sel,
    requestType,
    supplyAmendmentBundles,
    visitWin,
    resolvedVisitDate,
    visitDate,
    visitTimeComposed,
    validationCopy,
    formatMaxVisitDate,
  ]);

  const openConfirmedRevalidationReview = useCallback(() => {
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    setConfirmReviewMode("revalidation");
    const built = buildPatientConfirmSelection(
      items,
      sel,
      requestType,
      supplyAmendmentBundles,
      dt.formatDateShort,
      confirmLineCopy,
    );
    const err = validatePatientConfirmBeforeReview(
      items,
      sel,
      built.rpcPayload,
      visitWin,
      resolvedVisitDate,
      resolvedVisitDate,
      { ...validationCopy, ...confirmLineCopy },
      formatMaxVisitDate
    );
    if (err) {
      setActionError(err);
      return;
    }
    setActionError("");
    const skippedLines = buildNonRetainedConfirmLines(
      items,
      sel,
      requestType,
      supplyAmendmentBundles,
      confirmLineCopy,
    );
    setConfirmReviewSnap({
      rpcPayload: built.rpcPayload,
      preview: built.preview,
      skippedLines,
      plannedVisitDate: resolvedVisitDate,
      plannedVisitTimePg: htmlTimeToPg(visitTimeComposed),
      visitSummaryFr: dt.formatPlannedVisit(resolvedVisitDate, htmlTimeToPg(visitTimeComposed) ?? null),
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
    validationCopy,
    formatMaxVisitDate,
  ]);

  const startConfirmedRevalidation = useCallback(() => {
    if (detailStale) {
      setActionError(detailStale.message);
      return;
    }
    const baseline = computeSelFromConfirmedItems(items);
    setConfirmedRevalidationBaseline(baseline);
    setConfirmedRevalidationMode(true);
    setSel(baseline);
    setActionError("");
  }, [items, detailStale]);

  const cancelConfirmedRevalidation = useCallback(() => {
    setConfirmedRevalidationMode(false);
    setConfirmedRevalidationBaseline(null);
    setSel(computeSelFromConfirmedItems(items));
    setActionError("");
  }, [items]);

  const confirmedRevalidationDirty = useMemo(() => {
    if (!confirmedRevalidationMode) return false;
    if (!confirmedRevalidationBaseline) return false;
    return !lineSelMapsEqual(sel, confirmedRevalidationBaseline);
  }, [confirmedRevalidationMode, confirmedRevalidationBaseline, sel]);

  useEffect(() => {
    if (!confirmReviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeConfirmReview();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReviewOpen, closeConfirmReview]);

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
        setActionError(tValidation("qtyExceedsServer"));
      } else {
        setActionError(msg);
      }
      return;
    }
    closeConfirmReview();
    setConfirmedRevalidationMode(false);
    setConfirmedRevalidationBaseline(null);
    await onReload();
  };

  const validateResubmitLines = (): string | null => {
    if (lines.length === 0) return tCommon("addAtLeastOneProduct");
    const seen = new Set<string>();
    for (const l of lines) {
      if (seen.has(l.product_id)) return tValidation("duplicateProduct");
      seen.add(l.product_id);
      if (l.qty < 1 || l.qty > 10) return tCommon("qtyBetween1And10");
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
      const maxDate = formatMaxVisitDate(visitWin.maxYmd);
      setActionError(
        visitWin.hasToOrder
          ? tCommon("visitDateOutOfRangeOrder", { maxDate })
          : tCommon("visitDateOutOfRange", { maxDate })
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
  const resubmitChanges = useMemo(
    () => diffResubmitLines(resubmitBaseline, lines),
    [resubmitBaseline, lines]
  );

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
  const plannedVisitDateYmd = useMemo(
    () => (initialPlannedVisitDate ?? "").trim() || visitDate.trim(),
    [initialPlannedVisitDate, visitDate]
  );
  const showArchivePassageLine =
    readOnlyArchive && Boolean(plannedVisitDateYmd.trim());
  const plannedVisitTimePg = useMemo(
    () =>
      visitTimeComposed.trim() !== ""
        ? htmlTimeToPg(visitTimeComposed)
        : (initialPlannedVisitTime ?? null),
    [visitTimeComposed, initialPlannedVisitTime]
  );

  const treatedPassageLine = useMemo(() => {
    if (!isTreatedActiveView) return "";
    return dt.plannedVisitPassageLine(plannedVisitDateYmd, plannedVisitTimePg);
  }, [isTreatedActiveView, plannedVisitDateYmd, plannedVisitTimePg, dt.plannedVisitPassageLine]);

  const archivePassageFootnote = useMemo(() => {
    if (!showArchivePassageLine) return null;
    return dt.archiveLastPlannedVisitFootnote(plannedVisitDateYmd, plannedVisitTimePg);
  }, [showArchivePassageLine, plannedVisitDateYmd, plannedVisitTimePg, dt.archiveLastPlannedVisitFootnote]);

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
      brand={productPhotoPreview?.brand}
      productType={productPhotoPreview?.product_type}
      descriptionHtml={productPhotoPreview?.descriptionHtml}
      catalogExplorerPreview={productPhotoPreview?.catalogExplorerPreview}
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
  const usesLineWorkflowUi =
    requestType === "product_request" ||
    requestType === "prescription" ||
    requestType === "free_consultation";
  const canPatientRevalidateConfirmation =
    uiStatus === "confirmed" && !forceReadOnly && usesLineWorkflowUi;
  const showProductResubmit =
    !forceReadOnly &&
    !isPrescription &&
    !isConsultation &&
    (uiStatus === "submitted" || uiStatus === "in_review");
  const showConsultationWaiting =
    isConsultation && (uiStatus === "submitted" || uiStatus === "in_review");
  const showPrescriptionWaiting =
    !forceReadOnly &&
    isPrescription &&
    (uiStatus === "submitted" || uiStatus === "in_review") &&
    prescriptionPaths?.page1;
  const showWaitingShell = showProductResubmit || showPrescriptionWaiting || showConsultationWaiting;
  const showPatientExitCTA =
    !forceReadOnly &&
    !showPrescriptionWaiting &&
    !showConsultationWaiting &&
    (status === "submitted" ||
      status === "in_review" ||
      status === "responded" ||
      status === "confirmed" ||
      status === "treated");
  const patientExitPrimaryLabel =
    status === "submitted" || status === "in_review"
      ? i18nWorkflowCopy.patientCancelWhileWaitingLabel
      : tCommon("abandonRequest");
  /** Date/heure de passage : à la validation (responded) et pour modifier après coup. */
  const showVisitFields = (showConfirm || showConfirmedCards) && !forceReadOnly;
  const visitFieldsEditable = showVisitFields && !forceReadOnly;

  const visitTimeFr = visitTimeComposed ? dt.formatTimePg(htmlTimeToPg(visitTimeComposed) ?? visitTimeComposed) : "";

  const dossierRefLabel = requestPublicRef?.trim() || `Dossier ${requestId.slice(0, 8)}…`;

  const confirmReserveLines =
    confirmReviewSnap?.preview.filter((l) => l.bucket === "reserve") ?? [];
  const confirmOrderLines = confirmReviewSnap?.preview.filter((l) => l.bucket === "order") ?? [];
  const confirmAllPreviewLines = confirmReviewSnap?.preview ?? [];
  const confirmSkippedLines = confirmReviewSnap?.skippedLines ?? [];

  const useCompactPassageBlock = !forceReadOnly && showConfirmedCards;
  const workflowDossierSectionShell = patientWorkflowDossierSectionShellClass(requestType);
  const useWorkflowAccentDossierShell =
    hasPatientWorkflowAccentShell(requestType) &&
    usesLineWorkflowUi &&
    !(summaryInPageChrome && isConsultation);
  const useArchiveShell = forceReadOnly && usesLineWorkflowUi && !useWorkflowAccentDossierShell;
  const showArchiveDossierHeader = forceReadOnly && usesLineWorkflowUi;
  const isExpiredProductArchive = status === "expired" && usesLineWorkflowUi;
  const isCancelledProductArchive = status === "cancelled" && usesLineWorkflowUi;
  const isAbandonedProductArchive = status === "abandoned" && usesLineWorkflowUi;
  const isClosedProductArchive =
    isPatientProductClosedArchiveStatus(status) && usesLineWorkflowUi;
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
  const archiveTerminalFootnote =
    readOnlyArchive && terminalHistoryEntry?.created_at
      ? dt.archiveTerminalFootnote(terminalHistoryEntry.created_at)
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
          : tCommon("archiveReadOnly");
  const archiveDossierStatusDetail = isExpiredProductArchive
    ? patientExpiredDossierStatusHintFr({
        expiredAt: terminalHistoryEntry?.created_at ?? null,
        expiresAt: requestTimelineMeta?.expires_at ?? null,
        respondedAt: requestTimelineMeta?.responded_at ?? null,
      })
    : isCancelledProductArchive
      ? isPrescription && items.length === 0
        ? patientCancelledPrescriptionEmptyArchiveDetailFr(terminalHistoryEntry)
        : patientCancelledDossierStatusHintFr(terminalHistoryEntry)
      : isAbandonedProductArchive
        ? isPrescription && items.length === 0
          ? patientAbandonedPrescriptionEmptyArchiveDetailFr(terminalHistoryEntry)
          : patientAbandonedDossierStatusHintFr(terminalHistoryEntry)
        : isClosedProductArchive
          ? patientClosedDossierStatusHintFr({
              terminalStatus: status,
              items,
              historyEntry: terminalHistoryEntry,
            })
          : tCommon("archiveReadOnlyNoEdit");

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

  const dossierEditActive =
    !forceReadOnly &&
    ((showProductResubmit && editMode) ||
      (showPrescriptionWaiting && prescriptionEditMode) ||
      (showConfirmedCards && confirmedRevalidationMode));

  const dossierEditTone: StickyFooterTone =
    showPrescriptionWaiting && prescriptionEditMode
      ? "amber"
      : showConfirmedCards && confirmedRevalidationMode
        ? "sky"
        : "slate";

  return (
    <>
    <section
      className={clsx(
        "touch-pan-y w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
        isConsultation ? "mt-0" : "mt-2",
        useWorkflowAccentDossierShell && workflowDossierSectionShell
          ? workflowDossierSectionShell
          : useArchiveShell
            ? "mt-2 border-0 bg-transparent p-0 shadow-none ring-0"
            : "border-slate-200 bg-slate-50/95",
        isConsultation && showConsultationWaiting && "pb-2",
        dossierEditActive && dossierEditModeShellClass(dossierEditTone),
      )}
    >
      {dossierEditActive ? (
        <DossierEditModeIndicator
          active
          tone={dossierEditTone}
          title={tCommon("editModeBannerTitle")}
          hint={tCommon("editModeBannerHint")}
          className="mb-2.5"
          sticky
        />
      ) : null}

      {actionError ? (
        <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-[11px] text-destructive">{actionError}</p>
      ) : null}

      {showConsultationWaiting && items.length === 0 ? (
        <p className="mb-2 rounded-lg border border-violet-200/50 bg-white/80 px-2.5 py-2 text-[11px] leading-snug text-violet-950 ring-1 ring-violet-100/25">
          {tDemandes("consultationWaiting.noProductsYet")}
        </p>
      ) : null}

      {(showWaitingShell || showConfirm || showConfirmedCards || useArchiveShell) &&
      pharmacyId &&
      !summaryInPageChrome &&
      !forceReadOnly ? (
        showProductResubmit || showConfirm || showConfirmedCards || showPrescriptionWaiting ? (
          <PatientProductRequestDossierHeader
            dossierRefLabel={dossierRefLabel}
            pharmacyContact={pharmacyContact ?? null}
            pharmacyId={pharmacyId}
            kindLabel={workflowCopy.patientSummaryKindLabel}
            requestType={requestType}
            status={showConfirm ? "responded" : status}
            statusHint={summaryStatusHint(showConfirm ? "responded" : status)}
            statusDetail={summaryStatusDetail(showConfirm ? "responded" : status)}
            submittedAt={requestTimelineMeta?.submitted_at}
            createdAt={requestTimelineMeta?.created_at}
          />
        ) : (
          <PatientSentEnvoyeeSummaryCard
            pharmacyContact={pharmacyContact}
            pharmacyId={pharmacyId}
            dossierRefLabel={dossierRefLabel}
            lineCount={items.length}
            lineCountLabel={lineCountLabel(
              requestType,
              showConfirm ? "responded" : status,
              items.length,
            )}
            status={status}
            createdAt={requestTimelineMeta?.created_at ?? ""}
            updatedAt={requestUpdatedAt ?? requestTimelineMeta?.created_at ?? ""}
            submittedAt={requestTimelineMeta?.submitted_at}
            kindLabel={workflowCopy.patientSummaryKindLabel}
            refShort={workflowCopy.patientSummaryRefShort}
            statusHint={summaryStatusHint(status)}
            accent={accent}
            requestType={requestType}
          />
        )
      ) : null}

      {latestSupplyAmendmentNotice && !forceReadOnly ? (
        <PatientPharmaUpdateBanner whenLabel={latestSupplyAmendmentNotice.whenLabel} bundles={supplyAmendmentBundles} />
      ) : null}

      {showArchiveDossierHeader && pharmacyId ? (
        <PatientProductRequestDossierHeader
          dossierRefLabel={dossierRefLabel}
          pharmacyContact={pharmacyContact ?? null}
          pharmacyId={pharmacyId}
          kindLabel={workflowCopy.patientSummaryKindLabel}
          requestType={requestType}
          status={isDossierTerminalArchive ? archiveDossierStatusLabel : uiStatus}
          statusHint={archiveDossierStatusHint}
          statusDetail={archiveDossierStatusDetail}
          submittedAt={requestTimelineMeta?.submitted_at}
          createdAt={requestTimelineMeta?.created_at}
        />
      ) : null}

      {isClosedProductArchive && pharmacyId ? (
        <div className="mt-3 rounded-xl border border-border/80 border-l-[3px] border-l-emerald-500/70 bg-muted/20 px-3 py-3 text-center">
          <p className="text-sm font-bold text-foreground">Merci pour votre confiance</p>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            Votre officine a clos ce dossier. Nous espérons que votre passage s&apos;est bien passé et vous accueillir
            à nouveau bientôt.
          </p>
        </div>
      ) : null}

      {isResubmitDraftArchive && pharmacyId && !isPrescription ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={openArchiveResubmitDraft}
            className={uiActionBtnFull("flex items-center justify-center")}
          >
            Ajuster et renvoyer une nouvelle demande
          </button>
          <p className="mt-1.5 text-center text-[10px] leading-snug text-muted-foreground">
            Ouvre une nouvelle demande chez cette officine avec vos produits préremplis — vous validez l&apos;envoi sur
            la page suivante.
          </p>
        </div>
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
        <p className="mt-2 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-[11px] font-medium text-muted-foreground">
          Dossier {requestStatusFr[status] ?? status} — consultation en lecture seule.
        </p>
      ) : null}

      {isPrescription &&
      hasPrescriptionScan(prescriptionPaths) &&
      (showConfirm || showConfirmedCards || forceReadOnly) ? (
        <PrescriptionScanCollapsible
          paths={prescriptionPaths!}
          defaultOpen={forceReadOnly && items.length === 0}
          className="mb-2"
        />
      ) : null}

      {forceReadOnly && isPrescription && prescriptionNote?.trim() ? (
        <div className="mb-2 rounded-xl border border-border/80 bg-card px-3 py-2.5 text-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Votre message</p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">{prescriptionNote.trim()}</p>
        </div>
      ) : null}

      {forceReadOnly && archiveSnapshotStatus && usesLineWorkflowUi && items.length > 0 ? (
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
        </>
      ) : null}

      {showConfirm && !forceReadOnly ? (
        <div className="mt-3 w-full min-w-0">
          {items.length > 0 ? (
            (() => {
              const respondedBuckets = bucketPatientRespondedLines(
                items,
                requestType,
                supplyAmendmentBundles
              );
              return (
                <div className="w-full min-w-0 space-y-5">
                  {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
                    const rows = respondedBuckets[bucketId];
                    if (rows.length === 0) return null;
                    return (
                      <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length}>
                        <ul className={patientBucketProductListClass}>
                          {rows.map((row) => (
                            <RespondedPatientLineChooser
                              key={row.id}
                              row={row}
                              bucketId={bucketId}
                              selState={sel[row.id] ?? emptyLineSelState()}
                              setLineBranch={setLineBranch}
                              setLineQty={setLineQty}
                              toggleLineRetention={toggleLineRetention}
                              onPhotoPreview={openProductPhotoPreview}
                              pharmacistProposedBadgeLabel={badgeForRow(row) ?? tCommon("pharmacyAddition")}
                              requestType={requestType}
                              supplyAmendmentBundles={supplyAmendmentBundles}
                              resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
                            />
                          ))}
                        </ul>
                      </PatientRespondedBucketSection>
                    );
                  })}
                </div>
              );
            })()
          ) : null}
        </div>
      ) : null}

      {showConfirmedCards && !forceReadOnly ? (
        (() => {
          if (confirmedRevalidationMode && status === "confirmed") {
            const revalBuckets = bucketPatientRespondedLines(
              items,
              requestType,
              supplyAmendmentBundles
            );
            return (
              <section className="mt-4 w-full min-w-0 space-y-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {tDemandes("validated.modifyValidation")}
                </h3>
                <div className="w-full min-w-0 space-y-5">
                  {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
                    const rows = revalBuckets[bucketId];
                    if (rows.length === 0) return null;
                    return (
                      <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length}>
                        <ul className={patientBucketProductListClass}>
                          {rows.map((row) => (
                            <RespondedPatientLineChooser
                              key={row.id}
                              row={row}
                              bucketId={bucketId}
                              selState={sel[row.id] ?? emptyLineSelState()}
                              setLineBranch={setLineBranch}
                              setLineQty={setLineQty}
                              toggleLineRetention={toggleLineRetention}
                              onPhotoPreview={openProductPhotoPreview}
                              pharmacistProposedBadgeLabel={badgeForRow(row) ?? tCommon("pharmacyAddition")}
                              requestType={requestType}
                              supplyAmendmentBundles={supplyAmendmentBundles}
                              resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
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
            <section className="mt-3 w-full min-w-0 space-y-5 px-0">
              <h3 className="pt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {workflowCopy.patientProductsSectionTitle}
              </h3>
              {dispoRetenues.length > 0 ? (
                <PatientValidatedBucketSection
                  bucketId="dispo_officine"
                  count={dispoRetenues.length}
                  isTreatedView={isTreatedProductsView}
                  subtotalLabel={compactTotalMadLabel({
                    sumKnown: subtotalDispo.sumKnown,
                    missingPrice: subtotalDispo.missingPrice,
                    empty: subtotalDispo.count < 1,
                  })}
                >
                  <ul className={patientBucketProductListClass}>
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
                </PatientValidatedBucketSection>
              ) : null}

              {aCommanderRetenues.length > 0 ? (
                <PatientValidatedBucketSection
                  bucketId="commande"
                  count={aCommanderRetenues.length}
                  isTreatedView={isTreatedProductsView}
                  subtotalLabel={compactTotalMadLabel({
                    sumKnown: subtotalCommande.sumKnown,
                    missingPrice: subtotalCommande.missingPrice,
                    empty: subtotalCommande.count < 1,
                  })}
                >
                  <ul className={patientBucketProductListClass}>
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
                </PatientValidatedBucketSection>
              ) : null}

              {horsPerimetreRetenues.length > 0 ? (
                <PatientValidatedBucketSection
                  bucketId="hors_perimetre"
                  count={horsPerimetreRetenues.length}
                  hint={tCommon("confirmWithPharmacyHint")}
                >
                  <ul className={patientBucketProductListClass}>
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
                </PatientValidatedBucketSection>
              ) : null}

              {retireesApresValidation.length > 0 ? (
                <details className="group w-full min-w-0 rounded-lg border border-border/80 bg-muted/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="text-[12px] font-bold leading-none">
                      Retrait après validation
                      <span className="ml-1.5 tabular-nums font-semibold text-muted-foreground">
                        ({retireesApresValidation.length})
                      </span>
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <div className="space-y-2 border-t border-border/60 px-1 pb-1 pt-1">
                    <p className="px-1 text-[10px] leading-snug text-muted-foreground">
                      Retrait convenu avec la pharmacie — trace uniquement.
                    </p>
                    <ul className={patientBucketProductListClass}>
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
                <details className="group w-full min-w-0 rounded-lg border border-border/80 bg-muted/15">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-foreground [&::-webkit-details-marker]:hidden">
                    <span className="text-[12px] font-bold leading-none">
                      Lignes non retenues
                      <span className="ml-1.5 tabular-nums font-semibold text-muted-foreground">
                        ({lignesNonRetenues.length})
                      </span>
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <ul className={cn(patientBucketProductListClass, "border-t border-border/60 pt-1")}>
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
                            brand: h.brand,
                            product_type: h.product_type,
                            photo_url: h.photo_url ?? null,
                            unitPrice: resolveCatalogPrice(catalogHitToPricingInput(h)),
                          }}
                          onAdd={() => addProduct(h)}
                          onPhotoPreview={() =>
                            openProductPhotoPreview(
                              h.photo_url ?? null,
                              h.name,
                              h.full_description,
                              h.brand,
                              h.product_type,
                              { catalogExplorerPreview: true }
                            )
                          }
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
                  brand: l.brand,
                  product_type: l.product_type,
                  photo_url: l.photo_url,
                  qty: l.qty,
                  client_comment: l.client_comment,
                  line_source: l.line_source,
                  pharmacist_proposal_reason: l.pharmacist_proposal_reason,
                }}
                unitPrice={resubmitLineUnitPrice(l)}
                editMode={editMode}
                onRemove={editMode ? () => setLines((prev) => prev.filter((_, i) => i !== idx)) : undefined}
                onPhotoPreview={() =>
                  openProductPhotoPreview(
                    l.photo_url ?? null,
                    l.name,
                    l.full_description,
                    l.brand,
                    l.product_type,
                    { catalogExplorerPreview: true }
                  )
                }
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
        {showConfirmedCards && !confirmedRevalidationMode && !forceReadOnly ? (
          <DossierInlineActionPanel
            tone="slate"
            className="mt-2"
            summaryLeft={
              <>
                <span className="font-bold tabular-nums text-foreground">{totalsRetained.count}</span>{" "}
                {isTreatedActiveView
                  ? totalsRetained.count > 1
                    ? "produits à retirer"
                    : "produit à retirer"
                  : totalsRetained.count > 1
                    ? "produits retenus"
                    : "produit retenu"}
              </>
            }
            summaryRight={totalRetainedGrandLabel}
          />
        ) : null}

        {showVisitFields ? (
          <div
            className={clsx(
              "mt-4 space-y-2 border-t border-border/60 pt-3",
              useCompactPassageBlock && "text-center",
              !useCompactPassageBlock &&
                "rounded-xl border-2 p-2.5 shadow-md sm:p-3",
              !useCompactPassageBlock &&
                visitFieldsEditable &&
                "border-primary/35 bg-gradient-to-br from-primary/[0.12] via-background to-primary/[0.06] ring-1 ring-primary/25",
              !useCompactPassageBlock &&
                !visitFieldsEditable &&
                "border-slate-200/90 bg-slate-50/80 ring-1 ring-slate-200/50"
            )}
          >
            {!useCompactPassageBlock ? (
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
                    Date de passage
                  </p>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    {visitFieldsEditable
                      ? "Indique quand tu prévois de passer à l'officine."
                      : "Consultation seule — ce dossier n'accepte plus de modification."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-md space-y-1">
                <p className="text-xs font-bold text-foreground">Passage en officine</p>
                {isTreatedActiveView && treatedPassageLine ? (
                  <p className="text-[11px] font-semibold leading-snug text-foreground" role="status">
                    {treatedPassageLine}
                  </p>
                ) : null}
              </div>
            )}
            <div
              className={clsx(
                "flex gap-2",
                useCompactPassageBlock
                  ? "mx-auto w-fit max-w-full flex-row items-stretch justify-center"
                  : "flex-col sm:flex-row sm:items-stretch"
              )}
            >
              <label
                className={clsx(
                  "flex min-w-0 flex-col gap-1",
                  useCompactPassageBlock ? "w-[8rem] sm:w-[8.5rem]" : "flex-1"
                )}
              >
                <span className="text-[11px] font-semibold text-foreground">
                  Date {visitFieldsEditable && showConfirm ? <span className="text-destructive">*</span> : null}
                </span>
                <PlannedVisitDateInput
                  key={visitSyncKey}
                  valueYmd={showConfirm && visitFieldsEditable ? visitDate : resolvedVisitDate}
                  onChangeYmd={setVisitDate}
                  minYmd={visitWin.minYmd}
                  maxYmd={visitWin.maxYmd}
                  disabled={!visitFieldsEditable}
                  required={showConfirm && visitFieldsEditable}
                />
              </label>
              <div
                className={clsx(
                  "flex shrink-0 flex-col gap-1",
                  useCompactPassageBlock ? "w-[6.75rem] sm:w-[7.25rem]" : "w-full sm:w-[8.25rem]"
                )}
              >
                <span className="text-[11px] font-semibold text-foreground">
                  Heure{" "}
                  <span className="font-normal text-muted-foreground">(facultatif)</span>
                </span>
                <PlannedVisitTimeInput
                  hour={visitHour}
                  minute={visitMinute}
                  onHourChange={setVisitHour}
                  onMinuteChange={setVisitMinute}
                  disabled={!visitFieldsEditable}
                  appearance={useCompactPassageBlock ? "unified" : "split"}
                  className="w-full"
                />
              </div>
            </div>
            {visitTimeFr ? (
              <span
                className={clsx(
                  "block text-[10px] font-medium text-muted-foreground",
                  useCompactPassageBlock && "mx-auto max-w-md"
                )}
              >
                Enregistré : {visitTimeFr}
              </span>
            ) : null}
            {useCompactPassageBlock && visitFieldsEditable && showConfirmedCards && status === "confirmed" ? (
              <p className="mx-auto max-w-md text-[10px] leading-snug text-muted-foreground">
                La pharmacie voit les changements sur la demande.
              </p>
            ) : !useCompactPassageBlock && visitFieldsEditable && showConfirmedCards && status === "confirmed" ? (
              <p className="text-[10px] leading-snug text-primary/90">
                La pharmacie voit les changements sur la demande.
              </p>
            ) : useCompactPassageBlock && visitFieldsEditable && isTreatedActiveView ? (
              <p className="mx-auto max-w-md text-[10px] leading-snug text-muted-foreground">
                Modifiez la date ou l&apos;heure puis enregistrez ci-dessous.
              </p>
            ) : !useCompactPassageBlock && visitFieldsEditable && isTreatedActiveView ? (
              <p className="text-[10px] leading-snug text-sky-900/85">
                Modifiez la date ou l&apos;heure puis enregistrez ci-dessous.
              </p>
            ) : null}
            {showConfirmedCards && !confirmedRevalidationMode && visitFieldsEditable ? (
              <button
                type="button"
                disabled={busyAction !== "" || !visitPassageDirty || Boolean(detailStale)}
                onClick={() => void runUpdateVisit()}
                className={clsx(
                  uiActionBtnFull("mt-2 flex items-center justify-center"),
                  useCompactPassageBlock && "mx-auto max-w-md",
                )}
              >
                {busyAction === "visit"
                  ? tCommon("updating")
                  : isTreatedActiveView
                    ? tCommon("updateVisit")
                    : tCommon("updateVisitDate")}
              </button>
            ) : null}
          </div>
        ) : null}

        {(showConfirm || showConfirmedCards) && !forceReadOnly ? (
          pharmacyContact ? (
            <div className="mt-2">
              <PatientPharmacyQuickContact pharmacy={pharmacyContact} requestRef={dossierRefLabel} />
            </div>
          ) : (
            <section className="mt-2 rounded-xl border border-border bg-muted/25 px-2 py-1.5 text-[10px] leading-snug text-muted-foreground">
              {showConfirmedCards
                ? "Après validation, les changements passent par votre pharmacie."
                : "Les coordonnées de l’officine seront affichées ici lorsqu’elles sont disponibles."}
            </section>
          )
        ) : null}

        {showConfirmedCards && !showConfirm && usesLineWorkflowUi && !forceReadOnly ? (
          <p className="mt-3 rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
            Pour échanger avec la pharmacie à tout moment, utilise le bouton{" "}
            <strong className="font-semibold">Conversation</strong> en bas à droite de l&apos;écran.
          </p>
        ) : null}

        {showProductResubmit && !stickyFooterObscured ? (
          <DossierInlineActionPanel
            tone="slate"
            editing={editMode}
            editingLabel={tCommon("editModePanelLabel")}
            summaryLeft={
              <>
                <span className="font-bold tabular-nums text-foreground">{lines.length}</span>{" "}
                produit{lines.length > 1 ? "s" : ""}
              </>
            }
            summaryRight={formatPriceDh(resubmitTotal)}
          >
            {!editMode ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setEditMode(true);
                  }}
                  className={uiActionBtnFullOutline("flex items-center justify-center")}
                >
                  <Pencil size={16} aria-hidden />
                  {tCommon("edit")}
                </button>
                {resubmitDirty ? (
                  <button
                    type="button"
                    disabled={busyAction !== "" || lines.length === 0}
                    onClick={() => openResubmitConfirm()}
                    className={uiActionBtnFull("h-9 text-xs")}
                  >
                    {busyAction === "resubmit" ? tCommon("sending") : tCommon("resendToPharmacy")}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className={uiActionBtnFlexRow()}>
                <button
                  type="button"
                  disabled={busyAction !== ""}
                  onClick={() => {
                    resetResubmitDraft();
                    setEditMode(false);
                  }}
                  className={uiActionBtnFlexCancel()}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || !resubmitDirty || lines.length === 0}
                  onClick={() => openResubmitConfirm()}
                  className={uiActionBtnFlexPrimary()}
                >
                  {busyAction === "resubmit" ? tCommon("saving") : tCommon("saveChanges")}
                </button>
              </div>
            )}
          </DossierInlineActionPanel>
        ) : null}

        {showPrescriptionWaiting && !forceReadOnly && !stickyFooterObscured ? (
          <DossierInlineActionPanel
            tone="amber"
            editing={prescriptionEditMode}
            editingLabel={tCommon("editModePanelLabel")}
          >
            {!prescriptionEditMode ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.startEdit()}
                  className={uiActionBtnFullOutline("flex items-center justify-center")}
                >
                  <Pencil size={16} aria-hidden />
                  {tCommon("edit")}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.openCancelOrdonnance()}
                  className={uiActionBtnFullDestructive()}
                >
                  {workflowCopy.patientCancelWhileWaitingLabel}
                </button>
              </div>
            ) : (
              <div className={uiActionBtnFlexRow()}>
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy}
                  onClick={() => prescriptionPanelRef.current?.cancelEdit()}
                  className={uiActionBtnFlexCancel()}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  disabled={busyAction !== "" || prescriptionPanelBusy || !prescriptionPanelCanSave}
                  onClick={() => void prescriptionPanelRef.current?.save()}
                  className={uiActionBtnFlexPrimary()}
                >
                  {prescriptionPanelBusy ? tCommon("saving") : tCommon("saveChanges")}
                </button>
              </div>
            )}
          </DossierInlineActionPanel>
        ) : null}

        {showConfirm && !forceReadOnly && !stickyFooterObscured ? (
          <DossierInlineActionPanel
            tone={isPrescription ? "amber" : "sky"}
            summaryLeft={
              <>
                <span className="font-bold tabular-nums text-foreground">{confirmSelectionSummary.count}</span>{" "}
                {confirmSelectionSummary.count > 1 ? "lignes retenues" : "ligne retenue"}
              </>
            }
            summaryRight={
              confirmSelectionSummary.total > 0
                ? `${confirmSelectionSummary.total.toFixed(2)} MAD`
                : "—"
            }
          >
            <button
              type="button"
              disabled={busyAction !== "" || visitWin.missingEtaOnToOrder}
              onClick={openConfirmReview}
              className={uiActionBtnFull("flex items-center justify-center")}
            >
              Valider ma demande
            </button>
          </DossierInlineActionPanel>
        ) : null}

        {showConfirmedCards && !forceReadOnly && !stickyFooterObscured && confirmedRevalidationMode ? (
          <DossierInlineActionPanel
            tone="sky"
            editing
            editingLabel={tCommon("editModePanelLabel")}
          >
            <div className={uiActionBtnFlexRow()}>
              <button
                type="button"
                disabled={busyAction !== ""}
                onClick={cancelConfirmedRevalidation}
                className={uiActionBtnFlexCancel()}
              >
                {tCommon("cancel")}
              </button>
              <button
                type="button"
                disabled={busyAction !== "" || Boolean(detailStale) || !confirmedRevalidationDirty}
                onClick={openConfirmedRevalidationReview}
                className={uiActionBtnFlexPrimary("disabled:cursor-not-allowed")}
              >
                {busyAction === "confirm" ? tCommon("saving") : tCommon("saveChanges")}
              </button>
            </div>
          </DossierInlineActionPanel>
        ) : null}

        {showPatientExitCTA ? (
          <div className="mt-4 border-t border-rose-200/50 pt-3">
            {canPatientRevalidateConfirmation && !confirmedRevalidationMode ? (
              <button
                type="button"
                disabled={busyAction !== "" || Boolean(detailStale)}
                onClick={startConfirmedRevalidation}
                className={uiActionBtnFullSecondary("mb-3 flex items-center justify-center")}
              >
                <Pencil size={16} aria-hidden />
                {tDemandes("validated.modifyValidation")}
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
              className={uiActionBtnDestructiveWide("flex items-center justify-center")}
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

      {forceReadOnly && usesLineWorkflowUi ? (
        <div className="mt-6 space-y-2 border-t border-border/60 pt-4">
          {archiveTerminalFootnote ? (
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              <span className="block">{archiveTerminalFootnote.label}</span>
              {archiveTerminalFootnote.relative ? (
                <span className="mt-0.5 block text-[10px] text-slate-500/90">({archiveTerminalFootnote.relative})</span>
              ) : null}
            </p>
          ) : null}
          {archivePassageFootnote ? (
            <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
              <span className="block">{archivePassageFootnote.label}</span>
              {archivePassageFootnote.relative ? (
                <span className="mt-0.5 block text-[10px] text-slate-500/90">({archivePassageFootnote.relative})</span>
              ) : null}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>

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
              dossierUiTheme.modalShell
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={cn(
                "shrink-0 border-b px-3 py-2.5",
                isPrescription ? "border-amber-200/80 bg-amber-50/40" : productRequestTheme.modalHeader
              )}
            >
              <h2
                id="confirm-review-title"
                className={cn(
                  "text-center text-sm font-bold leading-snug sm:text-base",
                  isPrescription ? "text-amber-950" : "text-sky-950"
                )}
              >
                {confirmReviewMode === "revalidation" ? tCommon("saveValidation") : tCommon("confirmSelection")}
              </h2>
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-2.5 py-2.5 sm:px-3 [-webkit-overflow-scrolling:touch]",
                isPrescription
                  ? "bg-gradient-to-b from-amber-50/25 via-white to-muted/15"
                  : "bg-gradient-to-b from-sky-50/20 via-white to-muted/15"
              )}
            >
              {confirmReviewMode === "initial" ? (
                <div
                  className={cn(
                    "rounded-xl border-2 px-3 py-3 shadow-sm ring-1",
                    isPrescription
                      ? "border-amber-300/80 bg-gradient-to-br from-amber-50 via-white to-amber-100/60 ring-amber-200/70"
                      : "border-sky-300/80 bg-gradient-to-br from-sky-50 via-white to-sky-100/60 ring-sky-200/70"
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide",
                      isPrescription ? "text-amber-900" : "text-sky-900"
                    )}
                  >
                    Date de passage en officine
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-base font-bold leading-snug sm:text-lg",
                      isPrescription ? "text-amber-950" : "text-sky-950"
                    )}
                  >
                    {confirmReviewSnap.visitSummaryFr}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-[11px] leading-snug",
                      isPrescription ? "text-amber-900/85" : "text-sky-900/85"
                    )}
                  >
                    Présentez-vous à la pharmacie à ce créneau pour retirer vos produits réservés.
                  </p>
                </div>
              ) : (
                <p
                  className={cn(
                    "rounded-lg border px-2 py-1.5 text-[11px] leading-snug",
                    isPrescription
                      ? "border-amber-200/80 bg-amber-50/80 text-amber-950"
                      : "border-sky-200/80 bg-sky-50/80 text-sky-950"
                  )}
                >
                  Vérifiez vos produits retenus et quantités avant enregistrement.
                </p>
              )}

              {confirmReserveLines.length > 0 ? (
                <div className="mt-3">
                  <div
                    className={cn(
                      "mb-1.5 flex items-center gap-1.5 rounded-md border px-2 py-1",
                      isPrescription
                        ? "border-amber-200/80 bg-amber-50/80"
                        : "border-sky-200/80 bg-sky-50/80"
                    )}
                  >
                    <Package
                      className={cn("size-3.5 shrink-0", isPrescription ? "text-amber-800" : "text-sky-800")}
                      aria-hidden
                    />
                    <p
                      className={cn(
                        "text-[9px] font-bold uppercase tracking-wide",
                        isPrescription ? "text-amber-950" : "text-sky-950"
                      )}
                    >
                      {tDemandes("sections.toReserve")}
                    </p>
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
                  <p
                    className={cn(
                      "mt-2 text-right text-[11px] leading-snug font-medium",
                      isPrescription ? "text-amber-900/90" : "text-sky-900/90"
                    )}
                  >
                    {formatBlockSubtotalLabel(confirmReserveLines)}
                  </p>
                </div>
              ) : null}

              {confirmOrderLines.length > 0 ? (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center gap-1.5 rounded-md border border-teal-200/85 bg-teal-50/70 px-2 py-1">
                    <ShoppingCart className="size-3.5 shrink-0 text-teal-950" aria-hidden />
                    <p className="text-[9px] font-bold uppercase tracking-wide text-teal-950">{tDemandes("sections.toOrder")}</p>
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
                  <p className="text-[9px] font-bold uppercase tracking-wide text-slate-700">{tDemandes("modal.skippedInfo")}</p>
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
                            {tCommon("proposal")}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[9px] text-muted-foreground">
                            {prescriptionCopy.validatedOriginFallbackPatient(requestType)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {(() => {
                const grand = blockMonetarySummary(confirmAllPreviewLines);
                return (
                  <div
                    className={cn(
                      "mt-4 rounded-xl border-2 px-3 py-3 shadow-md ring-2",
                      isPrescription
                        ? "border-amber-400/55 bg-gradient-to-br from-amber-50 via-white to-amber-100/70 ring-amber-200/50"
                        : "border-sky-400/55 bg-gradient-to-br from-sky-50 via-white to-sky-100/70 ring-sky-200/50"
                    )}
                  >
                    <p
                      className={cn(
                        "text-center text-[10px] font-bold uppercase tracking-wide",
                        isPrescription ? "text-amber-800" : "text-sky-800"
                      )}
                    >
                      Total de votre sélection
                    </p>
                    <p
                      className={cn(
                        "mt-1.5 text-center text-2xl font-bold leading-none tabular-nums sm:text-[1.65rem]",
                        isPrescription ? "text-amber-950" : "text-sky-950"
                      )}
                    >
                      {grand.missingUnitPrice && grand.sumKnown === 0
                        ? "—"
                        : `${grand.sumKnown.toFixed(2)} MAD`}
                    </p>
                    {grand.missingUnitPrice ? (
                      <p
                        className={cn(
                          "mt-1.5 text-center text-[10px] leading-snug",
                          isPrescription ? "text-amber-900/85" : "text-sky-900/85"
                        )}
                      >
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
                  className={uiActionBtnModalOutline("px-3 py-2 text-[12px] disabled:opacity-50")}
                >
                  {tCommon("back")}
                </button>
                <button
                  type="button"
                  disabled={busyAction === "confirm" || Boolean(detailStale)}
                  onClick={() => void performConfirmAfterReview()}
                  className={uiActionBtnModalPrimary("px-3 py-2 text-[12px] disabled:opacity-50")}
                >
                  {busyAction === "confirm"
                    ? tCommon("saving")
                    : confirmReviewMode === "revalidation"
                      ? tCommon("saveValidation")
                      : tCommon("confirmDefinitely")}
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
                {tDemandes("modal.resubmitTitle")}
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
              {resubmitChanges.length === 0 ? (
                <p className="text-xs leading-snug text-slate-600">Aucune modification détectée sur les produits.</p>
              ) : (
                <>
                  <p className="text-xs leading-snug text-slate-600">
                    {resubmitChanges.length} modification{resubmitChanges.length > 1 ? "s" : ""} — liste finale :{" "}
                    {lines.length} produit{lines.length > 1 ? "s" : ""}.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {resubmitChanges.map((ch, idx) => {
                      const l = ch.line;
                      const badge =
                        ch.kind === "added"
                          ? "Ajouté"
                          : ch.kind === "removed"
                            ? "Retiré"
                            : "Modifié";
                      return (
                        <li
                          key={`${l.product_id}-${ch.kind}-${idx}`}
                          className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1.5"
                        >
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                            {l.photo_url ? (
                              <img src={l.photo_url} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center">
                                <Package className="size-5 text-slate-400" aria-hidden />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="line-clamp-2 min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-900">
                                {l.name}
                              </p>
                              <span className="shrink-0 rounded-md bg-slate-200/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-800">
                                {badge}
                              </span>
                            </div>
                            {ch.kind === "modified" && ch.qtyBefore != null && ch.qtyAfter != null ? (
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                Qté <span className="tabular-nums line-through">{ch.qtyBefore}</span>
                                {" → "}
                                <span className="font-bold tabular-nums text-slate-900">{ch.qtyAfter}</span>
                              </p>
                            ) : ch.kind !== "removed" ? (
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                Qté <span className="font-bold tabular-nums text-slate-900">{l.qty}</span>
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] text-slate-600">
                                Qté précédente :{" "}
                                <span className="font-bold tabular-nums text-slate-900">{l.qty}</span>
                              </p>
                            )}
                            {ch.kind === "modified" && ch.commentBefore != null && ch.commentAfter != null ? (
                              <p className="mt-1 text-[10px] leading-snug text-slate-700">
                                Note : « {ch.commentBefore || "—"} » → « {ch.commentAfter || "—"} »
                              </p>
                            ) : ch.kind !== "removed" && l.client_comment?.trim() ? (
                              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-700">
                                {l.client_comment.trim()}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">TOTAL</span>
                <span className="text-lg font-bold tabular-nums text-sky-900">{formatPriceDh(resubmitTotal)}</span>
              </div>
              <div className={cn("mt-2", uiActionBtnFlexRow())}>
                <button
                  type="button"
                  disabled={busyAction === "resubmit" || Boolean(detailStale)}
                  onClick={() => setResubmitConfirmOpen(false)}
                  className={uiActionBtnFlexCancel()}
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  disabled={busyAction === "resubmit" || Boolean(detailStale)}
                  onClick={() => void executeResubmit()}
                  className={uiActionBtnModalFlexPrimary()}
                >
                  {busyAction === "resubmit" ? tCommon("sending") : tCommon("confirmResend")}
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
        patientView
      />
      {productPhotoPreviewModal}
    </>
  );
}
