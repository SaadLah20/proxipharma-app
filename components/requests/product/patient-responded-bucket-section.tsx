"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, Ban, CheckCircle2, Package, Truck } from "lucide-react";
import { clsx } from "clsx";
import {
  type PatientRespondedBucketId,
  patientRespondedBucketAccentTextClass,
  patientRespondedBucketAriaTitleFr,
  patientRespondedBucketCountBadgeClass,
  patientRespondedBucketHeaderBarClass,
  patientRespondedBucketSectionShellClass,
  patientRespondedBucketTitleFr,
} from "@/lib/patient-responded-line-buckets";

type Props = {
  bucketId: PatientRespondedBucketId;
  count: number;
  children: ReactNode;
};

function bucketIcon(bucketId: PatientRespondedBucketId): LucideIcon {
  switch (bucketId) {
    case "available":
      return CheckCircle2;
    case "partially_available":
      return Package;
    case "to_order":
      return Truck;
    case "indispo_with_alts":
      return ArrowLeftRight;
    case "indispo_no_alts":
      return Ban;
  }
}

export function PatientRespondedBucketSection({ bucketId, count, children }: Props) {
  const Icon = bucketIcon(bucketId);
  const title = patientRespondedBucketTitleFr(bucketId);
  const accentText = patientRespondedBucketAccentTextClass(bucketId);

  return (
    <section className="w-full min-w-0 space-y-1" aria-label={patientRespondedBucketAriaTitleFr(bucketId)}>
      <div className={clsx("flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5", patientRespondedBucketHeaderBarClass(bucketId))}>
        <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
        <h4 className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-foreground sm:text-[13px]">
          {title}
        </h4>
        <span
          className={clsx(
            "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
            patientRespondedBucketCountBadgeClass(bucketId)
          )}
        >
          {count}
        </span>
      </div>
      <div className={clsx("overflow-hidden rounded-lg", patientRespondedBucketSectionShellClass(bucketId))}>
        {children}
      </div>
    </section>
  );
}
