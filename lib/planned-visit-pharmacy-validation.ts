import type { PharmacyScheduleBundle } from "@/lib/annuaire/schedule-bundle";
import { findMoroccoHolidayOnDate } from "@/lib/morocco-public-holidays";
import {
  formatOpenSlotsLabelFr,
  isPharmacyClosedAllDay,
  isPharmacyOpenAt,
  openSlotsForDay,
  parseTimeHmToMinutes,
} from "@/lib/pharmacy-schedule-fr";
import { pharmacyScheduleLabelsForLocale } from "@/lib/pharmacy-schedule-labels";

const CASABLANCA_TZ = "Africa/Casablanca";

function casablancaDateTimeParts(now: Date): { dateIso: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CASABLANCA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = Number.parseInt(get("hour"), 10) || 0;
  const minute = Number.parseInt(get("minute"), 10) || 0;
  return {
    dateIso: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
  };
}

function todayIsoFromNow(now: Date): string {
  return casablancaDateTimeParts(now).dateIso;
}

export const PLANNED_VISIT_MIN_LEAD_MINUTES = 30;

export type PlannedVisitPharmacyValidationCode = "too_soon" | "day_closed" | "time_closed";

export type PlannedVisitPharmacyValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: PlannedVisitPharmacyValidationCode;
      message: string;
      slotsLabel?: string;
      timeLabel?: string;
      holidayLabel?: string;
    };

function minutesNowInCasablanca(now: Date): number {
  return casablancaDateTimeParts(now).minutes;
}

/** Délai minimum 30 min (fuseau Casablanca), sans horaires officine. */
export function validatePlannedVisitMinLead(
  dateYmd: string,
  timeHm: string,
  now: Date = new Date(),
): { ok: true } | { ok: false; code: "too_soon" } {
  const dateIso = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { ok: true };
  const visitMinutes = parseTimeHmToMinutes(timeHm.trim());
  if (visitMinutes == null) return { ok: true };
  const { dateIso: today, minutes: nowMinutes } = casablancaDateTimeParts(now);
  if (dateIso !== today) return { ok: true };
  if (visitMinutes < nowMinutes + PLANNED_VISIT_MIN_LEAD_MINUTES) {
    return { ok: false, code: "too_soon" };
  }
  return { ok: true };
}

function formatMinutesFr(minutes: number): string {
  return pharmacyScheduleLabelsForLocale("fr").formatMinutes(minutes);
}

function dayClosedMessage(dateIso: string, bundle: PharmacyScheduleBundle): string {
  const override = bundle.overrides.find((o) => o.day_date === dateIso);
  if (override?.override_type === "closed") {
    const label = override.label?.trim();
    return label
      ? `Cette officine est fermée ce jour-là (${label}). Choisissez une autre date.`
      : "Cette officine est fermée ce jour-là (fermeture exceptionnelle). Choisissez une autre date.";
  }
  if (override?.override_type === "holiday") {
    const label = override.label?.trim();
    return label
      ? `Cette officine est fermée ce jour-là (${label}). Choisissez une autre date.`
      : "Cette officine est fermée ce jour-là (jour férié). Choisissez une autre date.";
  }
  const holiday = findMoroccoHolidayOnDate(dateIso);
  if (holiday) {
    return `Cette officine est fermée ce jour-là (${holiday.labelFr}). Choisissez une autre date.`;
  }
  return "Cette officine est fermée ce jour-là. Choisissez une autre date.";
}

/** Valide date/heure de passage vs horaires officine (fuseau Casablanca). */
export function validatePlannedVisitAgainstPharmacy(
  bundle: PharmacyScheduleBundle,
  dateYmd: string,
  timeHm: string | null,
  now: Date = new Date(),
): PlannedVisitPharmacyValidationResult {
  const dateIso = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return { ok: true };
  }

  const { weekly, overrides, onCall } = bundle;

  if (isPharmacyClosedAllDay(weekly, overrides, onCall, dateIso)) {
    const holiday = findMoroccoHolidayOnDate(dateIso);
    return {
      ok: false,
      code: "day_closed",
      message: dayClosedMessage(dateIso, bundle),
      holidayLabel: holiday?.labelFr,
    };
  }

  const timeTrimmed = (timeHm ?? "").trim();
  if (timeTrimmed === "") {
    return { ok: true };
  }

  const visitMinutes = parseTimeHmToMinutes(timeTrimmed);
  if (visitMinutes == null) {
    return { ok: true };
  }

  const today = todayIsoFromNow(now);
  if (dateIso === today) {
    const nowMinutes = minutesNowInCasablanca(now);
    const minAllowed = nowMinutes + PLANNED_VISIT_MIN_LEAD_MINUTES;
    if (visitMinutes < minAllowed) {
      return {
        ok: false,
        code: "too_soon",
        message: "Choisissez une heure au moins 30 minutes à partir de maintenant.",
      };
    }
  }

  if (!isPharmacyOpenAt(weekly, overrides, onCall, dateIso, visitMinutes)) {
    const slotsLabel = formatOpenSlotsLabelFr(weekly, overrides, onCall, dateIso);
    const timeLabel = formatMinutesFr(visitMinutes);
    const slotsHint = slotsLabel ? ` Horaires ce jour : ${slotsLabel}.` : "";
    return {
      ok: false,
      code: "time_closed",
      message: `Cette officine est fermée à ${timeLabel}.${slotsHint}`,
      slotsLabel,
      timeLabel,
    };
  }

  return { ok: true };
}

/** Fixtures horaires par défaut Maroc (lun–ven 9–13 / 15–21, sam 9–13, dim fermé). */
export function defaultMoroccoWeeklyHoursFixture(): PharmacyScheduleBundle["weekly"] {
  const weekly: PharmacyScheduleBundle["weekly"] = [];
  for (let weekday = 1; weekday <= 7; weekday++) {
    if (weekday === 7) {
      weekly.push(
        { weekday, period: "morning", opens_at: null, closes_at: null, is_closed: true },
        { weekday, period: "afternoon", opens_at: null, closes_at: null, is_closed: true },
      );
    } else if (weekday === 6) {
      weekly.push(
        { weekday, period: "morning", opens_at: "09:00", closes_at: "13:00", is_closed: false },
        { weekday, period: "afternoon", opens_at: null, closes_at: null, is_closed: true },
      );
    } else {
      weekly.push(
        { weekday, period: "morning", opens_at: "09:00", closes_at: "13:00", is_closed: false },
        { weekday, period: "afternoon", opens_at: "15:00", closes_at: "21:00", is_closed: false },
      );
    }
  }
  return weekly;
}

/** Date ISO du prochain dimanche à partir d'une date de référence. */
export function nextSundayIsoFrom(refYmd: string): string {
  const [y, mo, d] = refYmd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  const js = dt.getDay();
  const daysUntilSunday = js === 0 ? 0 : 7 - js;
  dt.setDate(dt.getDate() + daysUntilSunday);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Export pour tests : créneaux ouverts. */
export { openSlotsForDay };
