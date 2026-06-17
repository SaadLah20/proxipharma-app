"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, Ban, CheckCircle2, Package, Truck } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { HubCopyAudience } from "@/lib/hub-copy-audience";
import { isPharmacienCopyAudience } from "@/lib/hub-copy-audience";
import {
  patientDossierBucketCountBadgeClass,
  patientDossierBucketHeaderPaddingClass,
  patientDossierBucketHeaderShellForPatient,
  patientDossierBucketTitleClass,
  patientDossierBucketTitlePharmacistClass,
} from "@/lib/patient-dossier-bucket-section-chrome";
import {
  type PatientRespondedBucketId,
  patientRespondedBucketAccentTextClass,
  patientRespondedBucketCountBadgeClass,
  patientRespondedBucketHeaderBarClass,
} from "@/lib/patient-responded-line-buckets";

type Props = {
  bucketId: PatientRespondedBucketId;
  count: number;
  audience?: HubCopyAudience;
  children: ReactNode;
};

const BUCKET_ICONS: Record<PatientRespondedBucketId, LucideIcon> = {
  available: CheckCircle2,
  partially_available: Package,
  to_order: Truck,
  indispo_with_alts: ArrowLeftRight,
  indispo_no_alts: Ban,
};

export function PatientRespondedBucketSection({ bucketId, count, audience = "patient", children }: Props) {
  const t = useTranslations("demandes.respondedBuckets");
  const Icon = BUCKET_ICONS[bucketId];
  const title = t(`${bucketId}.title`);
  const accentText = patientRespondedBucketAccentTextClass(bucketId);
  const ariaKey = isPharmacienCopyAudience(audience) ? "ariaPharmacist" : "ariaPatient";
  const hint = bucketId === "indispo_with_alts" ? t("indispo_with_alts.hint") : null;
  const isPharmacist = isPharmacienCopyAudience(audience);
  const headerBarClass = isPharmacist
    ? patientRespondedBucketHeaderBarClass(bucketId)
    : patientDossierBucketHeaderShellForPatient(patientRespondedBucketHeaderBarClass(bucketId));
  const countBadgeClass = isPharmacist
    ? patientRespondedBucketCountBadgeClass(bucketId)
    : patientDossierBucketCountBadgeClass;

  return (
    <section className="w-full min-w-0 space-y-1" aria-label={t(`${bucketId}.${ariaKey}`)}>
      <div
        className={clsx(
          "flex min-w-0 flex-col gap-0.5 rounded-lg",
          patientDossierBucketHeaderPaddingClass,
          headerBarClass,
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
          <h4 className={isPharmacist ? patientDossierBucketTitlePharmacistClass : patientDossierBucketTitleClass}>
            {title}
          </h4>
          <span
            className={clsx(
              "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
              countBadgeClass,
            )}
          >
            {count}
          </span>
        </div>
        {hint ? (
          <p className="ps-[1.375rem] text-[10px] leading-snug text-muted-foreground">{hint}</p>
        ) : null}
      </div>
      <div className="w-full min-w-0">{children}</div>
    </section>
  );
}
