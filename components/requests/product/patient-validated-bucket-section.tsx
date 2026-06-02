"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Package, Truck } from "lucide-react";
import { clsx } from "clsx";
import {
  type PatientValidatedBucketId,
  patientValidatedBucketAccentTextClass,
  patientValidatedBucketAriaTitleFr,
  patientValidatedBucketCountBadgeClass,
  patientValidatedBucketHeaderBarClass,
  patientValidatedBucketSectionShellClass,
  patientValidatedBucketTitleFr,
} from "@/lib/patient-validated-bucket-ui";

type Props = {
  bucketId: PatientValidatedBucketId;
  count: number;
  isTreatedView?: boolean;
  subtotalLabel?: string | null;
  hint?: string | null;
  children: ReactNode;
};

const BUCKET_ICONS: Record<PatientValidatedBucketId, LucideIcon> = {
  dispo_officine: Package,
  commande: Truck,
  hors_perimetre: AlertTriangle,
};

export function PatientValidatedBucketSection({
  bucketId,
  count,
  isTreatedView = false,
  subtotalLabel,
  hint,
  children,
}: Props) {
  const Icon = BUCKET_ICONS[bucketId];
  const title = patientValidatedBucketTitleFr(bucketId, isTreatedView);
  const accentText = patientValidatedBucketAccentTextClass(bucketId);

  return (
    <section
      className="w-full min-w-0 space-y-1"
      aria-label={patientValidatedBucketAriaTitleFr(bucketId, isTreatedView)}
    >
      <div
        className={clsx(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2.5 py-1.5",
          patientValidatedBucketHeaderBarClass(bucketId)
        )}
      >
        <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
        <h4 className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-foreground sm:text-[13px]">
          {title}
        </h4>
        {subtotalLabel ? (
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
            {subtotalLabel}
          </span>
        ) : null}
        <span
          className={clsx(
            "inline-flex shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ring-1",
            patientValidatedBucketCountBadgeClass()
          )}
        >
          {count}
        </span>
      </div>
      {hint ? (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      <div className={clsx("overflow-hidden rounded-lg", patientValidatedBucketSectionShellClass(bucketId))}>
        {children}
      </div>
    </section>
  );
}
