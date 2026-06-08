"use client";

import type { ReactNode } from "react";
import { PatientArchiveCollapsibleSection } from "@/components/requests/product/patient-archive-collapsible-section";
import { PatientProductRequestCompactLine } from "@/components/requests/product/patient-product-request-compact-line";
import { PatientRespondedBucketSection } from "@/components/requests/product/patient-responded-bucket-section";
import { RespondedPatientLineChooser } from "@/components/requests/product/patient-responded-line-chooser";
import type { LineSelState } from "@/components/requests/product/patient-product-request-actions";
import { PharmacistValidatedBucketSection } from "@/components/pharmacist/pharmacist-validated-bucket-section";
import {
  buildPharmacistValidatedBucketGroups,
  compactTotalMadLabel,
  monetaryTotalsForRetainedLines,
} from "@/lib/pharmacist-validated-bucket-layout";
import type { RequestArchiveSnapshotStatus } from "@/lib/request-archive-snapshot-status";
import {
  PATIENT_RESPONDED_BUCKET_ORDER,
  bucketPatientRespondedLines,
} from "@/lib/patient-responded-line-buckets";
import { patientBucketProductListClass } from "@/lib/patient-bucket-product-row-ui";
import {
  validatedBranchUnitPriceMad,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing/types";
import type { ProductPhotoPreviewHandler } from "@/components/requests/patient-product-photo-preview-modal";
import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { pharmacistProductSectionTitleClass } from "@/lib/pharmacist-product-dossier-shell";

function archiveProductsFrozenSectionShell(title: string, children: ReactNode) {
  return (
    <section className="w-full min-w-0 space-y-4">
      <div className="space-y-2">
        <h3 className={pharmacistProductSectionTitleClass}>{title}</h3>
        <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
          État enregistré au moment de la fermeture — consultation seule.
        </p>
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

type ArchiveFrozenProductEmbed = {
  name?: string | null;
  photo_url?: string | null;
  full_description?: string | null;
  brand?: string | null;
  product_type?: string | null;
};

function oneProduct(
  products: ArchiveFrozenProductEmbed | ArchiveFrozenProductEmbed[] | null | undefined
) {
  if (!products) return null;
  return Array.isArray(products) ? products[0] ?? null : products;
}

type ArchiveFrozenItem = PatientLineLike & {
  id: string;
  product_id: string | null;
  requested_qty: number;
  client_comment?: string | null;
  line_source?: string | null;
  pharmacist_proposal_reason?: string | null;
  products?: ArchiveFrozenProductEmbed | ArchiveFrozenProductEmbed[] | null;
};

/** Archive figée (annulée / expirée / abandonnée) — alignée `PatientArchiveFrozenProductsView`. */
export function PharmacistArchiveFrozenProductsView<T extends ArchiveFrozenItem>({
  snapshotStatus,
  terminalStatus,
  items,
  productsSectionTitle,
  requestType,
  supplyAmendmentBundles,
  archiveSel,
  pricingConfig,
  pharmacistProposedBadgeLabel,
  badgeForRow,
  onPhotoPreview,
  resolveCatalogUnitPriceForProduct,
  renderValidatedLine,
  renderNotRetainedLine,
}: {
  snapshotStatus: RequestArchiveSnapshotStatus;
  terminalStatus: string;
  items: T[];
  productsSectionTitle: string;
  requestType: string;
  supplyAmendmentBundles: { amendments: unknown }[];
  archiveSel: Record<string, LineSelState>;
  pricingConfig: PharmacyPricingConfig | null;
  pharmacistProposedBadgeLabel: string;
  badgeForRow: (row: T) => string | undefined;
  onPhotoPreview: ProductPhotoPreviewHandler;
  resolveCatalogUnitPriceForProduct: (
    productId: string,
    embed: {
      product_type?: string | null;
      price_pph?: number | null;
      price_ppv?: number | null;
      brand?: string | null;
      laboratory?: string | null;
    } | null
  ) => number | null;
  renderValidatedLine: (row: T) => ReactNode;
  renderNotRetainedLine: (row: T) => ReactNode;
}) {
  const noop = () => {};
  const emptySel: LineSelState = { branch: null, qty: 1, browseQty: {} };

  if (snapshotStatus === "submitted" || snapshotStatus === "in_review") {
    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      <ul className={patientBucketProductListClass}>
        {items.map((row) => {
          const prod = oneProduct(row.products);
          const unit = validatedBranchUnitPriceMad(row, pricingConfig, row.product_id ?? undefined);
          const photoPath = prod?.photo_url;
          return (
            <li key={row.id} className="list-none">
              <PatientProductRequestCompactLine
                line={{
                  product_id: row.product_id ?? "",
                  name: prod?.name ?? "Produit",
                  product_type: prod?.product_type ?? null,
                  photo_url: photoPath ?? null,
                  qty: row.requested_qty,
                  client_comment: row.client_comment ?? "",
                  line_source: row.line_source ?? undefined,
                  pharmacist_proposal_reason: row.pharmacist_proposal_reason ?? undefined,
                }}
                unitPrice={unit}
                editMode={false}
                onPhotoPreview={() => {
                  const url = photoPath ? resolvePublicMediaUrl(photoPath) ?? photoPath : null;
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
            </li>
          );
        })}
      </ul>
    );
  }

  if (snapshotStatus === "responded") {
    const respondedBuckets = bucketPatientRespondedLines(
      items as Parameters<typeof bucketPatientRespondedLines>[0],
      requestType,
      supplyAmendmentBundles
    );
    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      <div className="w-full min-w-0 space-y-5">
        {PATIENT_RESPONDED_BUCKET_ORDER.map((bucketId) => {
          const rows = respondedBuckets[bucketId];
          if (rows.length === 0) return null;
          return (
            <PatientRespondedBucketSection key={bucketId} bucketId={bucketId} count={rows.length} audience="pharmacien">
              <ul className={patientBucketProductListClass}>
                {rows.map((row) => (
                  <li key={row.id} className="list-none">
                    <RespondedPatientLineChooser
                      row={row as Parameters<typeof RespondedPatientLineChooser>[0]["row"]}
                      bucketId={bucketId}
                      selState={archiveSel[row.id] ?? emptySel}
                      setLineBranch={noop}
                      setLineQty={noop}
                      toggleLineRetention={noop}
                      onPhotoPreview={onPhotoPreview}
                      pharmacistProposedBadgeLabel={
                        badgeForRow(row as T) ?? pharmacistProposedBadgeLabel
                      }
                      requestType={requestType}
                      supplyAmendmentBundles={supplyAmendmentBundles}
                      resolveCatalogUnitPrice={resolveCatalogUnitPriceForProduct}
                      readOnly
                    />
                  </li>
                ))}
              </ul>
            </PatientRespondedBucketSection>
          );
        })}
      </div>
    );
  }

  if (snapshotStatus === "confirmed" || snapshotStatus === "treated") {
    const bucketGroups = buildPharmacistValidatedBucketGroups(items, snapshotStatus, pricingConfig);
    const retainedForTotals = items.filter(
      (r) => r.is_selected_by_patient && !r.withdrawn_after_confirm
    );
    const totalsRetained = monetaryTotalsForRetainedLines(
      retainedForTotals,
      terminalStatus,
      pricingConfig
    );

    return archiveProductsFrozenSectionShell(
      productsSectionTitle,
      <>
        {bucketGroups.map((group) => {
          if (group.kind === "sky_nonretenus") {
            return (
              <PatientArchiveCollapsibleSection
                key={group.kind}
                title={group.title}
                count={group.rows.length}
              >
                <ul className={patientBucketProductListClass}>
                  {group.rows.map((row) => (
                    <li key={row.id} className="list-none">
                      {renderNotRetainedLine(row as T)}
                    </li>
                  ))}
                </ul>
              </PatientArchiveCollapsibleSection>
            );
          }
          if (group.kind === "red_ecart") {
            return (
              <PatientArchiveCollapsibleSection
                key={group.kind}
                title={group.title}
                count={group.rows.length}
                variant="withdrawn"
                hint={group.hint}
              >
                <ul className={patientBucketProductListClass}>
                  {group.rows.map((row) => (
                    <li key={row.id} className="list-none">
                      {renderValidatedLine(row as T)}
                    </li>
                  ))}
                </ul>
              </PatientArchiveCollapsibleSection>
            );
          }
          return (
            <PharmacistValidatedBucketSection
              key={group.kind}
              group={group}
              isTreatedView={snapshotStatus === "treated"}
            >
              <ul className={patientBucketProductListClass}>
                {group.rows.map((row) => (
                  <li key={row.id} className="list-none">
                    {renderValidatedLine(row as T)}
                  </li>
                ))}
              </ul>
            </PharmacistValidatedBucketSection>
          );
        })}

        {archiveRetainedTotalsFooter({
          count: totalsRetained.count,
          countLabel: totalsRetained.count > 1 ? "produits retenus" : "produit retenu",
          totalLabel: compactTotalMadLabel({
            sumKnown: totalsRetained.sumKnown,
            missingPrice: totalsRetained.missingPrice,
            empty: totalsRetained.count < 1,
          }),
        })}
      </>
    );
  }

  return null;
}
