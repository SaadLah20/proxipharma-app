"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { promoPatientStatusHint, promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import { formatDateForLocale, formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { promoReservationBadgeClass } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import type { PromoReservationStatus } from "@/lib/promo/types";

function cardShell(): string {
  return "rounded-xl border border-border bg-card shadow-sm ring-1 ring-black/[0.02]";
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
  const when = formatPickup(row.pickup_date, row.pickup_time, locale);
  const activity = formatDateTimeShortForLocale(row.updated_at, locale);

  return (
    <article className={clsx(cardShell(), "transition hover:-translate-y-px hover:shadow-md")}>
      <Link
        href={`/dashboard/patient/packs-promo/${row.id}`}
        className={clsx("group block", compact ? "p-2.5" : "p-3 sm:p-3.5")}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <PromoReservationStatusBadge status={row.status} role="patient" />

            <div>
              <p className="text-sm font-bold leading-snug break-words text-foreground sm:text-[15px]">
                {row.offer?.title ?? t("packFallback")}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                {row.pharmacy?.nom ? pharmacyPublicLabel(row.pharmacy.nom) : t("pharmacyFallback")}
              </p>
              {row.public_ref ? (
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-muted-foreground">{row.public_ref}</p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border/80 bg-muted/25 px-2 py-1.5 text-[11px] leading-snug text-foreground sm:text-xs">
              <p className="font-semibold">{promoPatientStatusHint(t, row.status)}</p>
              <p className="mt-0.5 text-[10px] font-medium opacity-90 sm:text-[11px]">
                {t("visit", { when })}
                {row.offer?.discount_percent ? ` · −${row.offer.discount_percent} %` : ""}
              </p>
            </div>

            <p className="text-[10px] tabular-nums text-muted-foreground">
              {t("dashboard.lastActivity", { when: activity })}
            </p>
          </div>

          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition group-hover:bg-muted/50"
            aria-hidden
          >
            →
          </span>
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
  const patientName = row.patient?.full_name?.trim() || "Patient";

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
    <article className={clsx(cardShell(), "transition hover:-translate-y-px hover:shadow-md")}>
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
