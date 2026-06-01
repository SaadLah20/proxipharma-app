"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  type PatientClosedArchiveLineBucketId,
  patientClosedArchiveBucketHeaderClass,
  patientClosedArchiveBucketTitleFr,
} from "@/lib/patient-closed-archive-line-buckets";

type Props = {
  bucketId: PatientClosedArchiveLineBucketId;
  count: number;
  subtotalLabel?: string | null;
  children: ReactNode;
};

/** Titre de groupe archive clôturée — sans carte colorée autour des lignes. */
export function PatientClosedArchiveBucketSection({
  bucketId,
  count,
  subtotalLabel,
  children,
}: Props) {
  return (
    <section className="w-full min-w-0 space-y-2">
      <div className="flex flex-nowrap items-baseline justify-between gap-2 px-0.5">
        <h4
          className={clsx(
            "min-w-0 text-[13px] font-extrabold uppercase tracking-wide sm:text-sm",
            patientClosedArchiveBucketHeaderClass(bucketId)
          )}
        >
          {patientClosedArchiveBucketTitleFr(bucketId)}
          <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
        </h4>
        {subtotalLabel ? (
          <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
            {subtotalLabel}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
