"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { pharmacistPromoReservationHubCardShellClass } from "@/lib/pharmacist-promo-reservation-line-ui";
import { PromoPackPreviewStrip } from "@/components/promo/promo-pack-preview-strip";
import { promoReservationBadgeClass } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import type { PromoReservationStatus } from "@/lib/promo/types";
import { formatShortId } from "@/lib/request-display";

function patientCardShell(): string {
  return "relative overflow-hidden rounded-xl border border-emerald-200/55 bg-card shadow-sm ring-1 ring-emerald-100/35 transition hover:-translate-y-px hover:shadow-md";
}

function pharmacistPatientDisplayName(row: PromoReservationHubRow): string {
  const name = row.patient?.full_name?.trim();
  if (name) return name;
  if (row.patient_id) return `Patient #${formatShortId(row.patient_id)}`;
  return "Patient";
}

function PromoReservationStatusBadge({
  status,
  role,
}: {
  status: PromoReservationStatus;
  role: "patient" | "pharmacien";
}) {
  const t = useTranslations("promo");
  const label =
    role === "patient"
      ? promoPatientStatusLabel(t, status)
      : (() => {
          switch (status) {
            case "submitted":
              return "À traiter";
            case "confirmed":
              return "Confirmée";
            case "unavailable":
              return "Non disponible";
            case "collected":
              return "Récupérée";
            case "cancelled":
              return "Annulée";
            default:
              return status;
          }
        })();

  return (
    <span
      className={clsx(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold leading-tight",
        promoReservationBadgeClass(status),
      )}
    >
      {label}
    </span>
  );
}

export function PatientPromoReservationHubCard({
  row,
  locale,
  compact = false,
}: {
  row: PromoReservationHubRow;
  locale: AppLocale;
  compact?: boolean;
}) {
  const t = useTranslations("promo");
  const activity = formatDateTimeShortForLocale(row.updated_at, locale);

  return (
    <article className={patientCardShell()}>
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden />
      <Link
        href={`/dashboard/patient/packs-promo/${row.id}`}
        className={clsx("group block py-3 pl-3.5 pr-3 sm:py-3.5 sm:pl-4", compact && "py-2.5 pl-3")}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <PromoReservationStatusBadge status={row.status} role="patient" />
              {row.public_ref ? (
                <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-[11px]">
                  {row.public_ref}
                </span>
              ) : null}
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-snug text-foreground sm:text-[15px]">
                  {row.offer?.title ?? t("packFallback")}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {row.pharmacy?.nom ? pharmacyPublicLabel(row.pharmacy.nom) : t("pharmacyFallback")}
                </p>
              </div>
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground"
                aria-hidden
              />
            </div>

            {row.pack_lines && row.pack_lines.length > 0 ? (
              <PromoPackPreviewStrip lines={row.pack_lines} />
            ) : null}

            <p className="text-[10px] tabular-nums text-muted-foreground">
              {t("dashboard.lastActivity", { when: activity })}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function PharmacistPromoReservationHubCard({
  row,
  compact = false,
}: {
  row: PromoReservationHubRow;
  compact?: boolean;
}) {
  const whenActivity = formatDateTimeShortForLocale(row.updated_at, "fr");
  const patientName = pharmacistPatientDisplayName(row);

  return (
    <article
      className={clsx(
        pharmacistPromoReservationHubCardShellClass,
        "relative overflow-hidden hover:-translate-y-px hover:shadow-md",
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500" aria-hidden />
      <Link
        href={`/dashboard/pharmacien/reservations-packs/${row.id}`}
        className={clsx("group block py-3 pl-3.5 pr-3 sm:py-3.5 sm:pl-4", compact && "py-2.5 pl-3")}
      >
        <div className="flex items-start gap-2 sm:gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <PromoReservationStatusBadge status={row.status} role="pharmacien" />
              {row.public_ref ? (
                <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground sm:text-[11px]">
                  {row.public_ref}
                </span>
              ) : null}
            </div>

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-snug text-foreground sm:text-[15px]">
                  {patientName}
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                  {row.offer?.title ?? "Pack promo"}
                </p>
              </div>
              <ChevronRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground"
                aria-hidden
              />
            </div>

            {row.pack_lines && row.pack_lines.length > 0 ? (
              <PromoPackPreviewStrip lines={row.pack_lines} />
            ) : null}

            <p className="text-[10px] tabular-nums text-muted-foreground">Dernière activité · {whenActivity}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export { PromoReservationStatusBadge };
