"use client";

import type { ReactNode } from "react";
import { PatientArchiveCollapsibleSection } from "@/components/requests/product/patient-archive-collapsible-section";
import { PatientClosedArchiveBucketSection } from "@/components/requests/product/patient-closed-archive-bucket-section";
import {
  PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER,
  bucketPatientClosedArchiveLines,
  patientClosedArchiveBucketTitleFr,
  type PatientClosedArchiveLineBucketId,
} from "@/lib/patient-closed-archive-line-buckets";
import { patientBucketProductListClass } from "@/lib/patient-bucket-product-row-ui";

type ClosedArchiveLineLike = {
  id: string;
  is_selected_by_patient: boolean;
  withdrawn_after_confirm?: boolean | null;
  counter_outcome?: string | null;
};

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

/** Dossier clôturé pharmacien — même structure que l’archive patient (3 blocs). */
export function PharmacistClosedProductBucketsView<T extends ClosedArchiveLineLike>({
  items,
  renderLine,
  recuperesSubtotalLabel,
  recuperesCountLabel,
  recuperesTotalLabel,
}: {
  items: T[];
  renderLine: (row: T, bucketId: PatientClosedArchiveLineBucketId) => ReactNode;
  recuperesSubtotalLabel?: string | null;
  recuperesCountLabel?: string;
  recuperesTotalLabel?: string | null;
}) {
  const closedBuckets = bucketPatientClosedArchiveLines(items);
  const listClass = patientBucketProductListClass;
  const pickedUpCount = closedBuckets.recuperes.length;

  return (
    <div className="w-full min-w-0 space-y-3">
      {PATIENT_CLOSED_ARCHIVE_BUCKET_ORDER.map((bucketId) => {
        const rows = closedBuckets[bucketId];
        if (rows.length === 0) return null;

        if (bucketId === "non_retenus" || bucketId === "ecartes") {
          const title =
            bucketId === "non_retenus"
              ? "Non retenus"
              : patientClosedArchiveBucketTitleFr(bucketId);
          return (
            <PatientArchiveCollapsibleSection
              key={bucketId}
              title={title}
              count={rows.length}
              variant={bucketId === "ecartes" ? "attention" : "neutral"}
              hint={
                bucketId === "ecartes"
                  ? "Produits non récupérés ou retirés par la pharmacie."
                  : undefined
              }
            >
              <ul className={listClass}>
                {rows.map((row) => (
                  <li key={row.id} className="list-none">
                    {renderLine(row, bucketId)}
                  </li>
                ))}
              </ul>
            </PatientArchiveCollapsibleSection>
          );
        }

        return (
          <PatientClosedArchiveBucketSection
            key={bucketId}
            bucketId={bucketId}
            count={rows.length}
            subtotalLabel={bucketId === "recuperes" ? recuperesSubtotalLabel : null}
          >
            <ul className={listClass}>
              {rows.map((row) => (
                <li key={row.id} className="list-none">
                  {renderLine(row, bucketId)}
                </li>
              ))}
            </ul>
          </PatientClosedArchiveBucketSection>
        );
      })}

      {recuperesTotalLabel && pickedUpCount > 0
        ? archiveRetainedTotalsFooter({
            count: pickedUpCount,
            countLabel:
              recuperesCountLabel ??
              (pickedUpCount > 1 ? "produits récupérés" : "produit récupéré"),
            totalLabel: recuperesTotalLabel,
          })
        : null}
    </div>
  );
}
