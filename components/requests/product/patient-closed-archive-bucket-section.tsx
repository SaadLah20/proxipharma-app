"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Ban, CheckCircle2, Package } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import {
  patientDossierBucketCountBadgeClass,
  patientDossierBucketHeaderPaddingClass,
  patientDossierBucketHeaderShellForPatient,
  patientDossierBucketTitleClass,
} from "@/lib/patient-dossier-bucket-section-chrome";
import {
  type PatientClosedArchiveLineBucketId,
  patientClosedArchiveBucketAccentTextClass,
  patientClosedArchiveBucketHeaderBarClass,
} from "@/lib/patient-closed-archive-line-buckets";

type Props = {
  bucketId: PatientClosedArchiveLineBucketId;
  count: number;
  subtotalLabel?: string | null;
  children: ReactNode;
};

const BUCKET_ICONS: Record<PatientClosedArchiveLineBucketId, LucideIcon> = {
  recuperes: CheckCircle2,
  ecartes: Ban,
  non_retenus: Package,
};

export function PatientClosedArchiveBucketSection({
  bucketId,
  count,
  subtotalLabel,
  children,
}: Props) {
  const t = useTranslations("demandes.archive.buckets");
  const Icon = BUCKET_ICONS[bucketId];
  const title = t(`${bucketId}.title`);
  const accentText = patientClosedArchiveBucketAccentTextClass(bucketId);
  const headerBarClass = patientDossierBucketHeaderShellForPatient(
    patientClosedArchiveBucketHeaderBarClass(bucketId),
  );

  return (
    <section className="w-full min-w-0 space-y-1" aria-label={t(`${bucketId}.aria`)}>
      <div
        className={clsx(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg",
          patientDossierBucketHeaderPaddingClass,
          headerBarClass,
        )}
      >
        <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
        <h4 className={patientDossierBucketTitleClass}>{title}</h4>
        {subtotalLabel ? (
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
            {subtotalLabel}
          </span>
        ) : null}
        <span
          className={clsx(
            "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
            patientDossierBucketCountBadgeClass,
          )}
        >
          {count}
        </span>
      </div>
      <div className="w-full min-w-0">{children}</div>
    </section>
  );
}
