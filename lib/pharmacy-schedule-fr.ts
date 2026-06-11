import type { AppLocale } from "@/lib/i18n/config";
import { findMoroccoHolidayOnDate } from "@/lib/morocco-public-holidays";
import {
  moroccoHolidayLabelForLocale,
  pharmacyScheduleLabelsForLocale,
  type PharmacyScheduleLabels,
} from "@/lib/pharmacy-schedule-labels";
import type {
  PharmacyDayOverrideRow,
  PharmacyDayScheduleLine,
  PharmacyOnCallPeriodRow,
  PharmacyOpenStatus,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";

export { OVERRIDE_TYPE_LABEL_FR } from "@/lib/pharmacy-schedule-labels";
export { ON_CALL_KIND_LABEL_FR } from "@/lib/pharmacy-schedule-labels-legacy";

const TZ = "Africa/Casablanca";

function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function slotLabel(
  opens: string | null,
  closes: string | null,
  closed: boolean,
  labels: PharmacyScheduleLabels,
): string | null {
  if (closed) return null;
  const o = parseTimeToMinutes(opens);
  const c = parseTimeToMinutes(closes);
  if (o == null || c == null) return null;
  return labels.formatSlot(o, c);
}

function nowInCasablanca(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function isoDateInCasablanca(d: Date = nowInCasablanca()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoWeekdayInCasablanca(d: Date = nowInCasablanca()): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

function minutesNowInCasablanca(): number {
  const d = nowInCasablanca();
  return d.getHours() * 60 + d.getMinutes();
}

function minutesFromIsoInCasablanca(iso: string): number {
  const d = new Date(iso);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return local.getHours() * 60 + local.getMinutes();
}

function periodStartDateIso(p: PharmacyOnCallPeriodRow): string {
  return isoDateInCasablanca(new Date(p.starts_at));
}

function periodEndDateIso(p: PharmacyOnCallPeriodRow): string {
  return isoDateInCasablanca(new Date(p.ends_at));
}

function periodOverlapsDate(p: PharmacyOnCallPeriodRow, dateIso: string): boolean {
  const startDay = periodStartDateIso(p);
  const endDay = periodEndDateIso(p);
  return dateIso >= startDay && dateIso <= endDay;
}

function isGardeFullDisplayDay(p: PharmacyOnCallPeriodRow, dateIso: string): boolean {
  if (!periodOverlapsDate(p, dateIso)) return false;
  const startDay = periodStartDateIso(p);
  const endDay = periodEndDateIso(p);
  if (dateIso === startDay) return true;
  if (dateIso === endDay) return false;
  return dateIso > startDay && dateIso < endDay;
}

function gardeTailEndMinutesOnDate(onCall: PharmacyOnCallPeriodRow[], dateIso: string): number | null {
  let max: number | null = null;
  for (const p of onCall) {
    if (!periodOverlapsDate(p, dateIso)) continue;
    if (isGardeFullDisplayDay(p, dateIso)) continue;
    if (periodEndDateIso(p) !== dateIso) continue;
    const m = minutesFromIsoInCasablanca(p.ends_at);
    if (max == null || m > max) max = m;
  }
  return max;
}

function gardeFullDayLine(periods: PharmacyOnCallPeriodRow[], labels: PharmacyScheduleLabels): string {
  const kind = periods[0]?.kind;
  const kindLab = kind ? labels.onCallKind[kind] : null;
  return kindLab ? `${labels.onCallFullDay} (${kindLab})` : labels.onCallFullDay;
}

function gardeTailLine(endMinutes: number, labels: PharmacyScheduleLabels): string {
  return labels.onCallUntil(labels.formatMinutes(endMinutes));
}

function weeklyForDay(weekly: PharmacyWeeklyHourRow[], weekday: number): PharmacyWeeklyHourRow[] {
  return weekly.filter((w) => w.weekday === weekday);
}

function buildDayLinesFromWeekly(
  weekly: PharmacyWeeklyHourRow[],
  weekday: number,
  labels: PharmacyScheduleLabels,
  opts?: { treatOpenFromMinutes?: number },
): string[] {
  const rows = weeklyForDay(weekly, weekday);
  if (!rows.length) return [labels.notProvided];

  const treatFrom = opts?.treatOpenFromMinutes ?? 0;
  const morning = rows.find((r) => r.period === "morning");
  const afternoon = rows.find((r) => r.period === "afternoon");

  const morningOpen = morning && !morning.is_closed ? parseTimeToMinutes(morning.opens_at) : null;
  const afternoonOpen =
    afternoon && !afternoon.is_closed ? parseTimeToMinutes(afternoon.opens_at) : null;

  const lines: string[] = [];

  const am = morning ? slotLabel(morning.opens_at, morning.closes_at, morning.is_closed, labels) : null;
  if (am && morningOpen != null && morningOpen >= treatFrom) {
    lines.push(labels.periodLine(labels.morning, am));
  }

  const pm = afternoon
    ? slotLabel(afternoon.opens_at, afternoon.closes_at, afternoon.is_closed, labels)
    : null;
  if (pm && afternoonOpen != null && afternoonOpen >= treatFrom) {
    lines.push(labels.periodLine(labels.afternoon, pm));
  }

  if (!am && afternoon?.is_closed && afternoonOpen != null && afternoonOpen >= treatFrom) {
    lines.push(labels.afternoonClosed);
  }
  if (
    !pm &&
    morning &&
    !morning.is_closed &&
    afternoon?.is_closed &&
    afternoonOpen != null &&
    afternoonOpen >= treatFrom
  ) {
    lines.push(labels.afternoonClosed);
  }

  if (lines.length === 0) {
    const anyOpenAfter =
      (morningOpen != null && morningOpen >= treatFrom && !morning?.is_closed) ||
      (afternoonOpen != null && afternoonOpen >= treatFrom && !afternoon?.is_closed);
    if (!anyOpenAfter && treatFrom === 0) lines.push(labels.closed);
  }

  return lines;
}

function buildMoroccoHolidayLines(dateIso: string, locale: AppLocale, labels: PharmacyScheduleLabels): string[] {
  const h = findMoroccoHolidayOnDate(dateIso);
  if (!h) return [labels.closed];
  const name = moroccoHolidayLabelForLocale(h, locale);
  return [labels.holidayLine(name, Boolean(h.uncertainDate))];
}

function isClosedLine(line: string, labels: PharmacyScheduleLabels): boolean {
  return (
    line === labels.closed ||
    line.startsWith(labels.closed) ||
    line.startsWith(labels.holidayPrefix) ||
    line.startsWith("Férié") ||
    line.startsWith("مغلق") ||
    line.startsWith("عطلة")
  );
}

function buildDayLinesFromOverride(
  o: PharmacyDayOverrideRow,
  labels: PharmacyScheduleLabels,
  opts?: { treatOpenFromMinutes?: number },
): string[] {
  if (o.override_type === "closed" || o.override_type === "holiday") {
    const trimmed = o.label?.trim();
    if (trimmed) {
      return [
        o.override_type === "holiday"
          ? labels.holidayWithLabel(trimmed)
          : labels.closedWithLabel(trimmed),
      ];
    }
    return [o.override_type === "holiday" ? labels.holidayPrefix : labels.closedExceptional];
  }
  const lines: string[] = [];
  if (o.label?.trim()) lines.push(o.label.trim());
  const am = slotLabel(o.morning_opens_at, o.morning_closes_at, false, labels);
  const pm = slotLabel(o.afternoon_opens_at, o.afternoon_closes_at, false, labels);
  const treatFrom = opts?.treatOpenFromMinutes ?? 0;
  const amOpen = parseTimeToMinutes(o.morning_opens_at);
  const pmOpen = parseTimeToMinutes(o.afternoon_opens_at);
  if (am && amOpen != null && amOpen >= treatFrom) lines.push(labels.periodLine(labels.morning, am));
  if (pm && pmOpen != null && pmOpen >= treatFrom) lines.push(labels.periodLine(labels.afternoon, pm));
  if (lines.length === 0) lines.push(labels.customHours);
  return lines;
}

function buildPublicDayLines(
  dateIso: string,
  weekday: number,
  weekly: PharmacyWeeklyHourRow[],
  override: PharmacyDayOverrideRow | undefined,
  onCall: PharmacyOnCallPeriodRow[],
  locale: AppLocale,
  labels: PharmacyScheduleLabels,
): { lines: string[]; isOnCallFullDay: boolean; isOnCallTailDay: boolean; isPublicHoliday: boolean } {
  const fullPeriods = onCall.filter((p) => isGardeFullDisplayDay(p, dateIso));
  if (fullPeriods.length > 0) {
    return { lines: [gardeFullDayLine(fullPeriods, labels)], isOnCallFullDay: true, isOnCallTailDay: false, isPublicHoliday: false };
  }

  const tailEnd = gardeTailEndMinutesOnDate(onCall, dateIso);
  const treatFrom = tailEnd ?? 0;
  const lines: string[] = [];
  const publicHoliday = findMoroccoHolidayOnDate(dateIso);

  if (tailEnd != null) lines.push(gardeTailLine(tailEnd, labels));

  const base = override
    ? buildDayLinesFromOverride(override, labels, { treatOpenFromMinutes: treatFrom })
    : publicHoliday
      ? buildMoroccoHolidayLines(dateIso, locale, labels)
      : buildDayLinesFromWeekly(weekly, weekday, labels, { treatOpenFromMinutes: treatFrom });

  for (const line of base) {
    if (tailEnd != null && isClosedLine(line, labels)) continue;
    lines.push(line);
  }

  if (tailEnd != null && base.length > 0 && lines.length === 1) {
    const weeklyFallback = buildDayLinesFromWeekly(weekly, weekday, labels, {
      treatOpenFromMinutes: treatFrom,
    });
    for (const line of weeklyFallback) {
      if (!isClosedLine(line, labels) && !lines.includes(line)) lines.push(line);
    }
  }

  if (lines.length === 0 && tailEnd != null) {
    lines.push(gardeTailLine(tailEnd, labels));
  }

  return {
    lines,
    isOnCallFullDay: false,
    isOnCallTailDay: tailEnd != null,
    isPublicHoliday: Boolean(publicHoliday && !override),
  };
}

/** 7 jours glissants (aujourd'hui + 6 suivants) — affichage public garde / horaires. */
export function buildCurrentWeekSchedule(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
  locale: AppLocale = "fr",
): PharmacyDayScheduleLine[] {
  const labels = pharmacyScheduleLabelsForLocale(locale);
  const now = nowInCasablanca();
  const todayIso = isoDateInCasablanca(now);

  const overrideByDate = new Map(overrides.map((o) => [o.day_date, o]));

  const out: PharmacyDayScheduleLine[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateIso = isoDateInCasablanca(d);
    const weekday = isoWeekdayInCasablanca(d);
    const override = overrideByDate.get(dateIso);
    const { lines, isOnCallFullDay, isOnCallTailDay, isPublicHoliday } = buildPublicDayLines(
      dateIso,
      weekday,
      weekly,
      override,
      onCall,
      locale,
      labels,
    );

    out.push({
      dateIso,
      weekdayLabel: labels.weekdayLabel(weekday),
      dateLabel: labels.dateLabel(dateIso),
      lines,
      isToday: dateIso === todayIso,
      isException: Boolean((override || isPublicHoliday) && !isOnCallFullDay),
      isOnCallFullDay,
      isOnCallTailDay,
      isPublicHoliday,
    });
  }
  return out;
}

/** @deprecated Préférer `buildCurrentWeekSchedule(..., locale)`. */
export function buildCurrentWeekScheduleFr(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
): PharmacyDayScheduleLine[] {
  return buildCurrentWeekSchedule(weekly, overrides, onCall, "fr");
}

function isOpenFromWeeklyAt(weekly: PharmacyWeeklyHourRow[], weekday: number, minutes: number): boolean {
  for (const row of weeklyForDay(weekly, weekday)) {
    if (row.is_closed) continue;
    const o = parseTimeToMinutes(row.opens_at);
    const c = parseTimeToMinutes(row.closes_at);
    if (o != null && c != null && minutes >= o && minutes < c) return true;
  }
  return false;
}

function isOpenFromOverrideAt(o: PharmacyDayOverrideRow, minutes: number): boolean | null {
  if (o.override_type === "closed" || o.override_type === "holiday") return false;
  let open = false;
  const amO = parseTimeToMinutes(o.morning_opens_at);
  const amC = parseTimeToMinutes(o.morning_closes_at);
  const pmO = parseTimeToMinutes(o.afternoon_opens_at);
  const pmC = parseTimeToMinutes(o.afternoon_closes_at);
  if (amO != null && amC != null && minutes >= amO && minutes < amC) open = true;
  if (pmO != null && pmC != null && minutes >= pmO && minutes < pmC) open = true;
  return open;
}

function isOnCallNowAt(onCall: PharmacyOnCallPeriodRow[], at: Date = new Date()): boolean {
  return onCall.some((p) => {
    const start = new Date(p.starts_at);
    const end = new Date(p.ends_at);
    return at >= start && at < end;
  });
}

function isOnCallOnDate(onCall: PharmacyOnCallPeriodRow[], dateIso: string): boolean {
  return onCall.some((p) => periodOverlapsDate(p, dateIso));
}

export function isOnCallBadgeVisibleAt(
  onCall: PharmacyOnCallPeriodRow[],
  at: Date = new Date(),
): boolean {
  return isOnCallNowAt(onCall, at);
}

export function resolvePharmacyOpenStatus(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
): {
  status: PharmacyOpenStatus;
  openLabel: string;
  onCallNow: boolean;
  onCallToday: boolean;
  onCallBadgeVisible: boolean;
} {
  const now = new Date();
  const todayIso = isoDateInCasablanca();
  const onCallNow = isOnCallNowAt(onCall, now);
  const onCallToday = isOnCallOnDate(onCall, todayIso);
  const onCallBadgeVisible = onCallNow;

  const minutes = minutesNowInCasablanca();
  const weekday = isoWeekdayInCasablanca();
  const override = overrides.find((o) => o.day_date === todayIso);

  let open = onCallNow;
  if (!open) {
    if (override) {
      const o = isOpenFromOverrideAt(override, minutes);
      open = o === true;
    } else if (findMoroccoHolidayOnDate(todayIso)) {
      open = false;
    } else {
      open = isOpenFromWeeklyAt(weekly, weekday, minutes);
    }
  }

  return {
    status: open ? "open" : "closed",
    openLabel: open ? "Ouverte" : "Fermée",
    onCallNow,
    onCallToday,
    onCallBadgeVisible,
  };
}

export type PharmacyOpenSlot = { startMin: number; endMin: number };

/** Date calendaire du jour en Africa/Casablanca (YYYY-MM-DD). */
export function todayIsoCasablanca(): string {
  return isoDateInCasablanca();
}

/** HH:MM ou HH:MM:SS → minutes depuis minuit. */
export function parseTimeHmToMinutes(hm: string | null | undefined): number | null {
  return parseTimeToMinutes(hm);
}

function isoWeekdayFromDateIso(dateIso: string): number {
  const [yStr, moStr, dStr] = dateIso.split("-");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  const js = new Date(y, mo - 1, d).getDay();
  return js === 0 ? 7 : js;
}

function visitInstantFromDateAndMinutes(dateIso: string, minutes: number): Date {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return new Date(
    `${dateIso}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+01:00`,
  );
}

function isOnCallAt(onCall: PharmacyOnCallPeriodRow[], dateIso: string, minutes: number): boolean {
  const at = visitInstantFromDateAndMinutes(dateIso, minutes);
  return onCall.some((p) => {
    const start = new Date(p.starts_at);
    const end = new Date(p.ends_at);
    return at >= start && at < end;
  });
}

function collectWeeklySlots(
  weekly: PharmacyWeeklyHourRow[],
  weekday: number,
  treatFrom = 0,
): PharmacyOpenSlot[] {
  const slots: PharmacyOpenSlot[] = [];
  for (const row of weeklyForDay(weekly, weekday)) {
    if (row.is_closed) continue;
    const o = parseTimeToMinutes(row.opens_at);
    const c = parseTimeToMinutes(row.closes_at);
    if (o == null || c == null) continue;
    const start = Math.max(o, treatFrom);
    if (start < c) slots.push({ startMin: start, endMin: c });
  }
  return slots;
}

function collectOverrideSlots(o: PharmacyDayOverrideRow, treatFrom = 0): PharmacyOpenSlot[] {
  if (o.override_type === "closed" || o.override_type === "holiday") return [];
  const slots: PharmacyOpenSlot[] = [];
  const amO = parseTimeToMinutes(o.morning_opens_at);
  const amC = parseTimeToMinutes(o.morning_closes_at);
  const pmO = parseTimeToMinutes(o.afternoon_opens_at);
  const pmC = parseTimeToMinutes(o.afternoon_closes_at);
  if (amO != null && amC != null) {
    const start = Math.max(amO, treatFrom);
    if (start < amC) slots.push({ startMin: start, endMin: amC });
  }
  if (pmO != null && pmC != null) {
    const start = Math.max(pmO, treatFrom);
    if (start < pmC) slots.push({ startMin: start, endMin: pmC });
  }
  return slots;
}

function onCallSlotsOnDate(onCall: PharmacyOnCallPeriodRow[], dateIso: string): PharmacyOpenSlot[] {
  const slots: PharmacyOpenSlot[] = [];
  for (const p of onCall) {
    if (!periodOverlapsDate(p, dateIso)) continue;
    if (isGardeFullDisplayDay(p, dateIso)) {
      slots.push({ startMin: 0, endMin: 24 * 60 });
      continue;
    }
    const startDay = periodStartDateIso(p);
    const endDay = periodEndDateIso(p);
    let startMin = 0;
    let endMin = 24 * 60;
    if (dateIso === startDay) {
      startMin = minutesFromIsoInCasablanca(p.starts_at);
    }
    if (dateIso === endDay) {
      endMin = minutesFromIsoInCasablanca(p.ends_at);
    }
    if (startMin < endMin) slots.push({ startMin, endMin });
  }
  return slots;
}

function mergeOpenSlots(slots: PharmacyOpenSlot[]): PharmacyOpenSlot[] {
  if (slots.length === 0) return [];
  const sorted = [...slots].sort((a, b) => a.startMin - b.startMin);
  const merged: PharmacyOpenSlot[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, cur.endMin);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/** Créneaux ouverts sur une date (hebdo + exceptions + gardes). */
export function openSlotsForDay(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
  dateIso: string,
): PharmacyOpenSlot[] {
  const fullPeriods = onCall.filter((p) => isGardeFullDisplayDay(p, dateIso));
  if (fullPeriods.length > 0) {
    return [{ startMin: 0, endMin: 24 * 60 }];
  }

  const slots: PharmacyOpenSlot[] = onCallSlotsOnDate(onCall, dateIso);
  const tailEnd = gardeTailEndMinutesOnDate(onCall, dateIso);
  const treatFrom = tailEnd ?? 0;
  const weekday = isoWeekdayFromDateIso(dateIso);
  const override = overrides.find((o) => o.day_date === dateIso);

  if (override) {
    slots.push(...collectOverrideSlots(override, treatFrom));
  } else if (!findMoroccoHolidayOnDate(dateIso)) {
    slots.push(...collectWeeklySlots(weekly, weekday, treatFrom));
  }

  return mergeOpenSlots(slots);
}

/** Aucun créneau ouvert sur la journée. */
export function isPharmacyClosedAllDay(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
  dateIso: string,
): boolean {
  return openSlotsForDay(weekly, overrides, onCall, dateIso).length === 0;
}

/** Officine ouverte à une minute précise (0–1439) ce jour-là. */
export function isPharmacyOpenAt(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
  dateIso: string,
  minutesOfDay: number,
): boolean {
  if (onCall.some((p) => isGardeFullDisplayDay(p, dateIso))) return true;
  if (isOnCallAt(onCall, dateIso, minutesOfDay)) return true;

  return openSlotsForDay(weekly, overrides, onCall, dateIso).some(
    (s) => minutesOfDay >= s.startMin && minutesOfDay < s.endMin,
  );
}

/** Libellé FR des créneaux ouverts (ex. « 9h00–13h00, 15h00–21h00 »). */
export function formatOpenSlotsLabelFr(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[],
  dateIso: string,
): string {
  const labels = pharmacyScheduleLabelsForLocale("fr");
  const slots = openSlotsForDay(weekly, overrides, onCall, dateIso);
  if (slots.length === 0) return "";
  return slots.map((s) => labels.formatSlot(s.startMin, s.endMin)).join(", ");
}
