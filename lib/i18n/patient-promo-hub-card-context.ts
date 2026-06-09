"use client";

import { useTranslations } from "next-intl";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import { promoPatientStatusHint } from "@/lib/i18n/promo-patient-status";
import { formatDateForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";

export type PatientPromoHubCardContext = {
  primaryLine: string;
  secondaryLine?: string;
  emphasis: "urgent" | "info" | "muted" | "success";
};

function formatPickup(date: string, time: string | null, locale: AppLocale) {
  const d = formatDateForLocale(`${date}T12:00:00`, locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (!time) return d;
  return `${d} · ${time.slice(0, 5)}`;
}

export function usePatientPromoHubCardContext(
  row: PromoReservationHubRow,
  locale: AppLocale,
): PatientPromoHubCardContext {
  const t = useTranslations("promo");
  const when = formatPickup(row.pickup_date, row.pickup_time, locale);
  const hint = promoPatientStatusHint(t, row.status);
  const discount =
    row.offer?.discount_percent && row.status !== "cancelled" && row.status !== "unavailable"
      ? ` · −${row.offer.discount_percent} %`
      : "";

  switch (row.status) {
    case "submitted":
      return {
        primaryLine: hint,
        secondaryLine: `${t("visit", { when })}${discount}`,
        emphasis: "info",
      };
    case "confirmed":
      return {
        primaryLine: hint,
        secondaryLine: `${t("visit", { when })}${discount}`,
        emphasis: "urgent",
      };
    case "collected":
      return { primaryLine: hint, emphasis: "success" };
    case "unavailable":
    case "cancelled":
      return { primaryLine: hint, emphasis: "muted" };
    default:
      return { primaryLine: hint, emphasis: "info" };
  }
}
