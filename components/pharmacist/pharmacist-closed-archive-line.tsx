"use client";

import type { ReactNode } from "react";
import { History, Package } from "lucide-react";
import { clsx } from "clsx";
import { PharmacistLineMessageButton } from "@/components/pharmacist/pharmacist-line-conversation-chip";
import { PharmacistSupplyCompactLine, type PharmacistSupplyLineTier } from "@/components/pharmacist/pharmacist-supply-compact-line";
import { patientBucketProductRowClass } from "@/lib/patient-bucket-product-row-ui";
import {
  bucketPatientValidatedLinesThreeWays,
  type PatientLineLike,
  validatedBranchUnitPriceMad,
  validatedBranchDescriptionHtml,
  validatedBranchPhotoPath,
  validatedProductLabel,
  validatedQtyForPatientLine,
} from "@/lib/patient-confirmed-line-buckets";
import {
  patientClosedArchiveClosureLabelFr,
  type PatientClosedArchiveLineBucketId,
} from "@/lib/patient-closed-archive-line-buckets";
import {
  buildPatientValidatedLineLabelsFr,
  validatedOriginLabelPharmacistFr,
} from "@/lib/patient-validated-line-labels-fr";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";

const VALIDATED_LINE_THUMB =
  "box-border size-[3.85rem] shrink-0 overflow-hidden rounded-md border border-border/80 bg-card";

export function supplyTierForClosedArchiveRow(row: PatientLineLike): PharmacistSupplyLineTier {
  const { dispoOfficine, aCommander, horsPerimetre } = bucketPatientValidatedLinesThreeWays([row]);
  if (dispoOfficine.some((r) => r.id === row.id)) return "dispo_officine";
  if (aCommander.some((r) => r.id === row.id)) return "commande";
  if (horsPerimetre.some((r) => r.id === row.id)) return "hors_perimetre";
  return row.withdrawn_after_confirm ? "retire_apres_validation" : "dispo_officine";
}

/** Ligne non retenue — archive clôturée (aligné patient). */
export function PharmacistClosedArchiveNotRetainedLine({
  row,
  productName,
  thumbUrl,
  statusLabel,
  lineKindLabel,
  qtyLabel = "Qté demandée",
  lineMessageButton,
  onOpenHistory,
  descriptionHtml,
  onPhotoPreview,
}: {
  row: { id: string; requested_qty: number };
  productName: string;
  thumbUrl: string | null;
  statusLabel: string | null;
  lineKindLabel: string | null;
  qtyLabel?: string;
  lineMessageButton: ReactNode;
  onOpenHistory: () => void;
  descriptionHtml?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
}) {
  const thumbInner = thumbUrl ? (
    onPhotoPreview ? (
      <button
        type="button"
        className="size-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        onClick={() => onPhotoPreview(thumbUrl, productName, descriptionHtml)}
        aria-label={`Agrandir la photo · ${productName}`}
      >
        <img src={thumbUrl} alt="" className="pointer-events-none h-full w-full object-cover opacity-90" />
      </button>
    ) : (
      <img src={thumbUrl} alt="" className="h-full w-full object-cover opacity-90" />
    )
  ) : (
    <span className="flex h-full w-full items-center justify-center">
      <Package className="size-5 text-muted-foreground" aria-hidden />
    </span>
  );

  return (
    <div className={patientBucketProductRowClass}>
      <div className="flex items-start gap-2.5">
        <div className={clsx(VALIDATED_LINE_THUMB, "self-start opacity-90")}>{thumbInner}</div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p
            className="line-clamp-2 min-w-0 text-[13px] font-semibold leading-snug text-muted-foreground line-through decoration-slate-400/90"
            title={productName}
          >
            {productName}
          </p>
          <div className="flex w-full items-end justify-between gap-3 leading-none">
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[10px] text-muted-foreground">
                {qtyLabel}{" "}
                <strong className="tabular-nums text-foreground/80">{row.requested_qty}</strong>
              </span>
              {statusLabel ? (
                <span className="rounded border border-border/80 bg-muted/25 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {statusLabel}
                </span>
              ) : null}
              {lineKindLabel ? (
                <span className="text-[10px] font-medium text-violet-800/90">{lineKindLabel}</span>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lineMessageButton}
              <button
                type="button"
                onClick={onOpenHistory}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm hover:bg-muted/50"
                aria-label="Historique de cette ligne"
                title="Historique"
              >
                <History className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Ligne archive retenue — carte compacte (aligné `PatientValidatedCompactLineCard`). */
export function PharmacistClosedArchiveValidatedLine({
  row,
  archiveBucket,
  requestType,
  supplyAmendmentBundles,
  pharmacistProposedBadgeLabel,
  prescriptionBadge,
  validatedName,
  validatedQty,
  unitPriceMad,
  lineTotalMad,
  thumbUrl,
  lineMessageButton,
  menuOpen,
  onMenuOpenChange,
  onMenuHistory,
  postConfirmAmendmentBadges,
  descriptionHtml,
  onPhotoPreview,
  archiveClosureLabel,
}: {
  row: PatientLineLike;
  archiveBucket: PatientClosedArchiveLineBucketId;
  /** Surcharge libellé clôture (archive figée validée / traitée). */
  archiveClosureLabel?: string | null;
  requestType: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  pharmacistProposedBadgeLabel: string;
  prescriptionBadge: string | null;
  validatedName: string;
  validatedQty: number;
  unitPriceMad: number | null;
  lineTotalMad: number | null;
  thumbUrl: string | null;
  lineMessageButton: ReactNode;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onMenuHistory: () => void;
  postConfirmAmendmentBadges?: string[];
  descriptionHtml?: string | null;
  onPhotoPreview?: ProductPhotoPreviewHandler;
}) {
  const supplyTier = supplyTierForClosedArchiveRow(row);
  const closureRaw =
    archiveClosureLabel !== undefined
      ? archiveClosureLabel
      : patientClosedArchiveClosureLabelFr(row);
  const closureForLabels =
    archiveClosureLabel !== undefined
      ? closureRaw
      : archiveBucket === "recuperes" && closureRaw === "Récupéré"
        ? null
        : archiveBucket === "ecartes" && (closureRaw === "Retiré" || closureRaw === "Non récupéré")
          ? null
          : closureRaw;
  const validatedLineLabels = buildPatientValidatedLineLabelsFr({
    row,
    originLabel: validatedOriginLabelPharmacistFr({
      row,
      requestType,
      pharmacistProposedBadgeLabel,
      prescriptionBadge,
    }),
    supplyAmendmentBundles,
    archiveClosureLabel: closureForLabels,
    treatedLineLabels: true,
    sectionBucket: supplyTier,
    labelAudience: "pharmacist",
  });

  return (
    <PharmacistSupplyCompactLine
      header={null}
      validatedName={validatedName}
      validatedQty={validatedQty}
      availSentence=""
      unitLabel={unitPriceMad != null ? `${unitPriceMad.toFixed(2)} MAD` : "—"}
      totalLabel={lineTotalMad != null ? `${lineTotalMad.toFixed(2)} MAD` : "—"}
      unitPriceMad={unitPriceMad}
      lineTotalMad={lineTotalMad}
      thumbUrl={thumbUrl}
      selected
      lineLockedTrace={false}
      withdrawn={Boolean(row.withdrawn_after_confirm)}
      effAvailRow={row.availability_status}
      canMarkReserved={false}
      canMarkOrdered={false}
      fulfillmentDraft="unset"
      onToggleReserved={() => {}}
      onToggleOrdered={() => {}}
      onToggleArrivedReserved={() => {}}
      canShowArrivedReservedPill={false}
      canMarkPickedUpCounterSupply={false}
      onMarkPickedUpCounter={() => {}}
      hasModifyConsent={false}
      busy={false}
      supplyConfirmBusy={false}
      lineCounterLocked
      showExpandedEditor={false}
      expandedEditor={null}
      treatedCounterSlot={null}
      lineMessageButton={lineMessageButton}
      postConfirmAmendmentBadges={postConfirmAmendmentBadges}
      menuOpen={menuOpen}
      onMenuOpenChange={onMenuOpenChange}
      onMenuModify={() => {}}
      onMenuWithdraw={() => {}}
      onMenuHistory={onMenuHistory}
      supplyMutationsEnabled={false}
      withdrawDisabled
      supplyTier={supplyTier}
      validatedLineLabels={validatedLineLabels}
      descriptionHtml={descriptionHtml}
      onPhotoPreview={onPhotoPreview}
    />
  );
}

export function closedArchiveLinePricing(row: PatientLineLike) {
  const validatedQty = validatedQtyForPatientLine(row);
  const unitPriceMad = validatedBranchUnitPriceMad(row);
  const lineTotalMad = unitPriceMad != null ? unitPriceMad * validatedQty : null;
  return { validatedQty, unitPriceMad, lineTotalMad };
}

export function closedArchiveThumbUrl(row: PatientLineLike) {
  return resolvePublicMediaUrl(validatedBranchPhotoPath(row));
}

export function closedArchiveDescriptionHtml(row: PatientLineLike) {
  return validatedBranchDescriptionHtml(row);
}

export { validatedProductLabel };
