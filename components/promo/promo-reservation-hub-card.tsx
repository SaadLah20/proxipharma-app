"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import { usePatientPromoHubCardContext } from "@/lib/i18n/patient-promo-hub-card-context";
import { formatDateForLocale, formatDateTimeShortForLocale } from "@/lib/datetime-locale";
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

function formatPickup(date: string, time: string | null, locale: AppLocale) {
  const d = formatDateForLocale(`${date}T12:00:00`, locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (!time) return d;
  return `${d} · ${time.slice(0, 5)}`;
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
  const ctx = usePatientPromoHubCardContext(row, locale);
  const activity = formatDateTimeShortForLocale(row.updated_at, locale);
  const contextLine = ctx.secondaryLine ? `${ctx.primaryLine} · ${ctx.secondaryLine}` : ctx.primaryLine;

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

            <p
              className={clsx(
                "line-clamp-2 text-[11px] leading-snug sm:text-xs",
                ctx.emphasis === "urgent"
                  ? "text-emerald-950"
                  : ctx.emphasis === "success"
                    ? "text-emerald-800"
                    : ctx.emphasis === "muted"
                      ? "text-muted-foreground/85"
                      : "text-muted-foreground",
              )}
            >
              {contextLine}
            </p>

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
  const whenPickup = formatPickup(row.pickup_date, row.pickup_time, "fr");
  const whenActivity = formatDateTimeShortForLocale(row.updated_at, "fr");
  const patientName = pharmacistPatientDisplayName(row);

  let contextPrimary = "";
  let contextSecondary = "";
  switch (row.status) {
    case "submitted":
      contextPrimary = "Nouvelle demande — confirmer ou décliner.";
      contextSecondary = `Passage souhaité : ${whenPickup}`;
      break;
    case "confirmed":
      contextPrimary = "Pack confirmé — en attente de retrait.";
      contextSecondary = `Passage prévu : ${whenPickup}`;
      break;
    case "collected":
      contextPrimary = "Pack récupéré par le client.";
      break;
    case "unavailable":
      contextPrimary = "Demande déclinée.";
      break;
    case "cancelled":
      contextPrimary = "Réservation annulée.";
      break;
  }

  return (
    <article className={clsx(pharmacistPromoReservationHubCardShellClass, "hover:-translate-y-px hover:shadow-md")}>
      <Link
        href={`/dashboard/pharmacien/reservations-packs/${row.id}`}
        className={clsx("group block", compact ? "p-2.5" : "p-3 sm:p-3.5")}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <PromoReservationStatusBadge status={row.status} role="pharmacien" />

            <div>
              <p className="truncate text-sm font-bold leading-tight text-foreground sm:text-[15px]">
                {patientName}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                {row.offer?.title ?? "Pack promo"}
              </p>
              {row.public_ref ? (
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted-foreground">{row.public_ref}</p>
              ) : null}
            </div>

            {row.pack_lines && row.pack_lines.length > 0 ? (
              <PromoPackPreviewStrip lines={row.pack_lines} />
            ) : null}

            {(contextPrimary || contextSecondary) && (
              <div className="rounded-lg border border-border/80 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug text-foreground sm:text-xs">
                {contextPrimary ? <p className="font-semibold">{contextPrimary}</p> : null}
                {contextSecondary ? (
                  <p className="mt-0.5 text-[10px] font-medium opacity-90 sm:text-[11px]">{contextSecondary}</p>
                ) : null}
              </div>
            )}

            <p className="text-[10px] tabular-nums text-muted-foreground">Dernière activité · {whenActivity}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export { PromoReservationStatusBadge };
