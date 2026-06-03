"use client";

import type { ReactNode } from "react";
import { PatientArchiveCollapsibleSection } from "@/components/requests/product/patient-archive-collapsible-section";
import { PatientValidatedBucketSection } from "@/components/requests/product/patient-validated-bucket-section";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import type {
  PharmacistValidatedBucketGroup,
  PharmacistValidatedBucketKind,
} from "@/lib/pharmacist-validated-bucket-layout";
import {
  type PatientValidatedBucketId,
  patientValidatedBucketAccentTextClass,
} from "@/lib/patient-validated-bucket-ui";

function bucketKindToPatientId(kind: PharmacistValidatedBucketKind): PatientValidatedBucketId | null {
  switch (kind) {
    case "sky_reserve":
      return "dispo_officine";
    case "teal_order":
      return "commande";
    case "amber_hors":
      return "hors_perimetre";
    default:
      return null;
  }
}

/** Titre + liste — même disposition que `PatientValidatedBucketSection`. */
export function PharmacistValidatedBucketSection<T extends PatientLineLike>({
  group,
  isTreatedView = false,
  children,
}: {
  group: Pick<
    PharmacistValidatedBucketGroup<T>,
    "kind" | "title" | "hint" | "totalLabel" | "collapsible" | "rows"
  >;
  isTreatedView?: boolean;
  children: ReactNode;
}) {
  const patientId = bucketKindToPatientId(group.kind);
  const count = group.rows.length;

  if (patientId != null) {
    return (
      <PatientValidatedBucketSection
        bucketId={patientId}
        count={count}
        isTreatedView={isTreatedView}
        subtotalLabel={group.totalLabel}
        hint={group.hint}
      >
        {children}
      </PatientValidatedBucketSection>
    );
  }

  if (group.collapsible) {
    return (
      <PatientArchiveCollapsibleSection
        title={group.title}
        count={count}
        hint={group.hint}
        variant={group.kind === "red_ecart" ? "withdrawn" : "neutral"}
      >
        {children}
      </PatientArchiveCollapsibleSection>
    );
  }

  return (
    <PatientArchiveCollapsibleSection title={group.title} count={count} hint={group.hint}>
      {children}
    </PatientArchiveCollapsibleSection>
  );
}

/** @deprecated Préférer patientValidatedBucketAccentTextClass via section. */
export function pharmacistValidatedBucketHeaderClass(kind: PharmacistValidatedBucketKind): string {
  const patientId = bucketKindToPatientId(kind);
  if (patientId) return patientValidatedBucketAccentTextClass(patientId);
  return "text-muted-foreground";
}
