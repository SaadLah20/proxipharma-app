import type { AppLocale } from "@/lib/i18n/config";
import { fallbackPatientNotificationArabic } from "@/lib/i18n/patient-notification-ar-fallback";
import { rewriteForPatientView } from "@/lib/patient-copy";

type NotificationRow = {
  title: string;
  body: string | null;
  title_ar?: string | null;
  body_ar?: string | null;
};

/** Choisit titre/corps notif selon locale patient (colonnes SQL ar ou repli FR). */
export function pickPatientNotificationText(
  row: NotificationRow,
  locale: AppLocale,
  audience: "patient" | "pharmacien" | "admin",
): { title: string; body: string | null } {
  if (audience !== "patient") {
    return {
      title: row.title,
      body: row.body,
    };
  }
  if (locale === "ar" && row.title_ar?.trim()) {
    return {
      title: row.title_ar,
      body: row.body_ar ?? row.body,
    };
  }
  if (locale === "ar") {
    return fallbackPatientNotificationArabic(row.title, row.body);
  }
  return {
    title: rewriteForPatientView(row.title) ?? row.title,
    body: rewriteForPatientView(row.body),
  };
}
