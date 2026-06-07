"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Package, Truck } from "lucide-react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { HubCopyAudience } from "@/lib/hub-copy-audience";
import {
  type PatientValidatedBucketId,
  patientValidatedBucketAccentTextClass,
  patientValidatedBucketAriaTitleFr,
  patientValidatedBucketAriaTitleI18n,
  patientValidatedBucketCountBadgeClass,
  patientValidatedBucketHeaderBarClass,
  patientValidatedBucketTitleFr,
  patientValidatedBucketTitleI18n,
} from "@/lib/patient-validated-bucket-ui";

type Props = {
  bucketId: PatientValidatedBucketId;
  count: number;
  isTreatedView?: boolean;
  subtotalLabel?: string | null;
  hint?: string | null;
  audience?: HubCopyAudience;
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
  audience = "patient",
  children,
}: Props) {
  const tDemandes = useTranslations("demandes");
  const Icon = BUCKET_ICONS[bucketId];
  const title =
    audience === "pharmacien"
      ? patientValidatedBucketTitleFr(bucketId, isTreatedView, audience)
      : patientValidatedBucketTitleI18n(tDemandes, bucketId, isTreatedView);
  const ariaTitle =
    audience === "pharmacien"
      ? patientValidatedBucketAriaTitleFr(bucketId, isTreatedView, audience)
      : patientValidatedBucketAriaTitleI18n(tDemandes, bucketId, isTreatedView);
  const accentText = patientValidatedBucketAccentTextClass(bucketId);
  const isPharmacist = audience === "pharmacien";

  return (
    <section
      className={clsx("w-full min-w-0", isPharmacist ? "space-y-2.5" : "space-y-1")}
      aria-label={ariaTitle}
    >
      <div
        className={clsx(
          "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg",
          isPharmacist ? "px-3 py-2" : "px-2.5 py-1.5",
          patientValidatedBucketHeaderBarClass(bucketId),
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
            patientValidatedBucketCountBadgeClass(),
          )}
        >
          {count}
        </span>
      </div>
      {hint ? (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      <div className="w-full min-w-0">{children}</div>
    </section>
  );
}
