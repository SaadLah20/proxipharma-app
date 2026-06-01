"use client";

import type { ReactNode } from "react";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import {
  type PharmacistValidatedBucketGroup,
} from "@/lib/pharmacist-validated-bucket-layout";
import { PharmacistValidatedBucketSection } from "@/components/pharmacist/pharmacist-validated-bucket-section";

export function PharmacistValidatedProductBuckets<T extends PatientLineLike>({
  groups,
  sectionTitle = "Produits de la commande validée",
  renderRow,
}: {
  groups: PharmacistValidatedBucketGroup<T>[];
  sectionTitle?: string;
  renderRow: (row: T) => ReactNode;
}) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
        Aucune ligne produit à afficher.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{sectionTitle}</h3>
      {groups.map((group) => (
        <PharmacistValidatedBucketSection key={group.kind} group={group}>
          <ul className="flex w-full min-w-0 flex-col divide-y divide-border/50 overflow-visible">
            {group.rows.map((row) => (
              <li key={row.id} className="list-none">
                {renderRow(row)}
              </li>
            ))}
          </ul>
        </PharmacistValidatedBucketSection>
      ))}
    </div>
  );
}
