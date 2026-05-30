"use client";

import type { ReactNode } from "react";
import { Ban, PackageCheck, RefreshCw, ShoppingCart, Split } from "lucide-react";
import { clsx } from "clsx";
import {
  type PatientRespondedBucketId,
  patientRespondedBucketCountBadgeClass,
  patientRespondedBucketHeaderClass,
  patientRespondedBucketHintFr,
  patientRespondedBucketIconClass,
  patientRespondedBucketSectionShellClass,
  patientRespondedBucketTitleFr,
} from "@/lib/patient-responded-line-buckets";

function PatientRespondedBucketIcon({ bucketId }: { bucketId: PatientRespondedBucketId }) {
  const className = clsx("size-4 shrink-0", patientRespondedBucketIconClass(bucketId));
  switch (bucketId) {
    case "available":
      return <PackageCheck className={className} aria-hidden />;
    case "partially_available":
      return <Split className={className} aria-hidden />;
    case "to_order":
      return <ShoppingCart className={className} aria-hidden />;
    case "indispo_with_alts":
      return <RefreshCw className={className} aria-hidden />;
    case "indispo_no_alts":
      return <Ban className={className} aria-hidden />;
  }
}

type Props = {
  bucketId: PatientRespondedBucketId;
  count: number;
  children: ReactNode;
};

export function PatientRespondedBucketSection({ bucketId, count, children }: Props) {
  return (
    <section
      className={clsx(
        "space-y-2.5 rounded-xl border-2 p-2.5 shadow-sm ring-1",
        patientRespondedBucketSectionShellClass(bucketId)
      )}
    >
      <div className={clsx("space-y-1 px-0.5", patientRespondedBucketHeaderClass(bucketId))}>
        <div className="flex items-start gap-2">
          <PatientRespondedBucketIcon bucketId={bucketId} />
          <div className="min-w-0 flex-1">
            <h4 className="text-[11px] font-extrabold uppercase leading-snug tracking-wide">
              {patientRespondedBucketTitleFr(bucketId)}
              <span
                className={clsx(
                  "ml-1.5 inline-flex min-w-[1.35rem] items-center justify-center rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ring-1",
                  patientRespondedBucketCountBadgeClass(bucketId)
                )}
              >
                {count}
              </span>
            </h4>
            <p className="mt-0.5 text-[10px] font-medium leading-snug opacity-90">
              {patientRespondedBucketHintFr(bucketId)}
            </p>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}
