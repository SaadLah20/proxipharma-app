"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Ban, ChevronDown, Package, Truck } from "lucide-react";
import { clsx } from "clsx";
import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";
import type {
  PharmacistValidatedBucketGroup,
  PharmacistValidatedBucketKind,
} from "@/lib/pharmacist-validated-bucket-layout";
import {
  type PatientValidatedBucketId,
  patientValidatedBucketAccentTextClass,
  patientValidatedBucketAriaTitleFr,
  patientValidatedBucketCountBadgeClass,
  patientValidatedBucketHeaderBarClass,
  patientValidatedBucketSectionShellClass,
  patientValidatedBucketTitleFr,
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

const NEUTRAL_BUCKET_ICONS: Partial<Record<PharmacistValidatedBucketKind, LucideIcon>> = {
  red_ecart: Ban,
  sky_nonretenus: Package,
};

const NEUTRAL_BUCKET_ACCENT: Partial<Record<PharmacistValidatedBucketKind, string>> = {
  red_ecart: "border-l-[3px] border-l-amber-500/75",
  sky_nonretenus: "border-l-[3px] border-l-slate-400/75",
};

const VALIDATED_BUCKET_ICONS: Record<PatientValidatedBucketId, LucideIcon> = {
  dispo_officine: Package,
  commande: Truck,
  hors_perimetre: AlertTriangle,
};

function neutralBucketShell(kind: PharmacistValidatedBucketKind): string {
  return clsx(
    "border border-border/80 bg-card shadow-none",
    NEUTRAL_BUCKET_ACCENT[kind] ?? "border-l-[3px] border-l-border"
  );
}

/** Titre + liste — aligné `PatientValidatedBucketSection`. */
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

  const title =
    patientId != null ? patientValidatedBucketTitleFr(patientId, isTreatedView) : group.title;
  const ariaLabel =
    patientId != null ? patientValidatedBucketAriaTitleFr(patientId, isTreatedView) : group.title;
  const Icon =
    patientId != null ? VALIDATED_BUCKET_ICONS[patientId] : NEUTRAL_BUCKET_ICONS[group.kind] ?? Package;
  const accentText =
    patientId != null ? patientValidatedBucketAccentTextClass(patientId) : "text-muted-foreground";
  const headerBarClass =
    patientId != null
      ? patientValidatedBucketHeaderBarClass(patientId)
      : clsx("rounded-lg px-2.5 py-1.5", neutralBucketShell(group.kind));
  const shellClass =
    patientId != null
      ? patientValidatedBucketSectionShellClass(patientId)
      : clsx("rounded-lg", neutralBucketShell(group.kind));

  const headerInner = (
    <>
      <Icon className={clsx("size-3.5 shrink-0", accentText)} strokeWidth={2.25} aria-hidden />
      <h4 className="min-w-0 flex-1 truncate text-[12px] font-bold leading-none text-foreground sm:text-[13px]">
        {title}
      </h4>
      {group.totalLabel ? (
        <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
          {group.totalLabel}
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
      {group.collapsible ? (
        <ChevronDown
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      ) : null}
    </>
  );

  if (group.collapsible) {
    return (
      <details className="group w-full min-w-0 space-y-1" aria-label={ariaLabel}>
        <summary className="flex min-w-0 cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 [&::-webkit-details-marker]:hidden">
          <div className={clsx("flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1", headerBarClass)}>
            {headerInner}
          </div>
        </summary>
        {group.hint ? (
          <p className="px-1 text-[10px] leading-snug text-muted-foreground">{group.hint}</p>
        ) : null}
        <div className={clsx("overflow-hidden", shellClass)}>{children}</div>
      </details>
    );
  }

  return (
    <section className="w-full min-w-0 space-y-1" aria-label={ariaLabel}>
      <div className={clsx("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", headerBarClass)}>
        {headerInner}
      </div>
      {group.hint ? (
        <p className="px-1 text-[10px] leading-snug text-muted-foreground">{group.hint}</p>
      ) : null}
      <div className={clsx("overflow-hidden", shellClass)}>{children}</div>
    </section>
  );
}

/** @deprecated Préférer patientValidatedBucketAccentTextClass via section. */
export function pharmacistValidatedBucketHeaderClass(kind: PharmacistValidatedBucketKind): string {
  const patientId = bucketKindToPatientId(kind);
  if (patientId) return patientValidatedBucketAccentTextClass(patientId);
  return "text-muted-foreground";
}
