"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import {
  type PatientValidatedBucketId,
  patientValidatedBucketHeaderClass,
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

/** Titre de groupe seul (couleur sémantique) — sans carte colorée autour des lignes. */
export function PatientValidatedBucketSection({
  bucketId,
  count,
  isTreatedView = false,
  subtotalLabel,
  hint,
  children,
}: Props) {
  const title = patientValidatedBucketTitleFr(bucketId, isTreatedView);
  const isLongTreatedTitle = isTreatedView && bucketId !== "hors_perimetre";

  return (
    <section className="w-full min-w-0 space-y-2">
      <div className="flex flex-nowrap items-baseline justify-between gap-2 px-0.5">
        <h4
          className={clsx(
            "min-w-0 font-extrabold uppercase tracking-wide",
            isLongTreatedTitle ? "text-[10px] leading-snug sm:text-[11px]" : "text-[13px] sm:text-sm",
            patientValidatedBucketHeaderClass(bucketId)
          )}
        >
          {title}
          <span className="ml-1.5 tabular-nums font-bold opacity-75">({count})</span>
        </h4>
        {subtotalLabel ? (
          <p className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
            {subtotalLabel}
          </p>
        ) : null}
      </div>
      {hint ? (
        <p className="px-0.5 text-[10px] leading-snug text-muted-foreground">{hint}</p>
      ) : null}
      {children}
    </section>
  );
}
