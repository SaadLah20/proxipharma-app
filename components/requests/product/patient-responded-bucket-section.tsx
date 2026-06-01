"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  type PatientRespondedBucketId,
  patientRespondedBucketHeaderClass,
  patientRespondedBucketTitleFr,
} from "@/lib/patient-responded-line-buckets";

type Props = {
  bucketId: PatientRespondedBucketId;
  count: number;
  children: ReactNode;
};

/** Titre de groupe seul (couleur sémantique) — sans carte ni phrase d’aide. */
export function PatientRespondedBucketSection({ bucketId, count, children }: Props) {
  return (
    <section className="w-full min-w-0 space-y-2">
      <h4
        className={clsx(
          "px-0.5 text-[13px] font-extrabold uppercase tracking-wide sm:text-sm",
          patientRespondedBucketHeaderClass(bucketId)
        )}
      >
        {patientRespondedBucketTitleFr(bucketId)}
        <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
      </h4>
      {children}
    </section>
  );
}
