import { formatDateShortFr } from "@/lib/datetime-fr";
import type {
  PharmacyDayOverrideRow,
  PharmacyDayScheduleLine,
  PharmacyOnCallPeriodRow,
  PharmacyOpenStatus,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";

const TZ = "Africa/Casablanca";

const WEEKDAY_FR = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export const OVERRIDE_TYPE_LABEL_FR: Record<PharmacyDayOverrideRow["override_type"], string> = {
  closed: "Fermeture exceptionnelle",
  holiday: "Jour férié",
  custom: "Horaires spécifiques",
};

export const ON_CALL_KIND_LABEL_FR: Record<string, string> = {
  weekend_48h: "Garde 48 h (week-end)",
  weekday_24h: "Garde 24 h (jour ouvré)",
  holiday_24h: "Garde 24 h (jour férié)",
};

const GARDE_FULL_DAY_LINE = "Permanence de garde — journée entière";

function parseTimeToMinutes(t: string | null | undefined): number | null {
  if (!t?.trim()) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function formatMinutesFr(min: number): string {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(h).padStart(2, "0")}h${String(mm).padStart(2, "0")}`;
}

function slotLabel(opens: string | null, closes: string | null, closed: boolean): string | null {
  if (closed) return null;
  const o = parseTimeToMinutes(opens);
  const c = parseTimeToMinutes(closes);
  if (o == null || c == null) return null;
  return `${formatMinutesFr(o)} – ${formatMinutesFr(c)}`;
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

/** Journée calendaire affichée « garde entière » (pas les créneaux habituels). */
function isGardeFullDisplayDay(p: PharmacyOnCallPeriodRow, dateIso: string): boolean {
  if (!periodOverlapsDate(p, dateIso)) return false;
  const startDay = periodStartDateIso(p);
  const endDay = periodEndDateIso(p);
  if (dateIso === startDay) return true;
  if (dateIso === endDay) return false;
  return dateIso > startDay && dateIso < endDay;
}

/** Fin de garde le même jour calendaire (ex. 9 mai 9h → 10 mai 9h : le 10 à 9h). */
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

function gardeFullDayLine(periods: PharmacyOnCallPeriodRow[]): string {
  const kind = periods[0]?.kind;
  const kindLab = kind ? ON_CALL_KIND_LABEL_FR[kind] : null;
  return kindLab ? `${GARDE_FULL_DAY_LINE} (${kindLab})` : GARDE_FULL_DAY_LINE;
}

function gardeTailLine(endMinutes: number): string {
  return `Garde jusqu'à ${formatMinutesFr(endMinutes)}`;
}

function weeklyForDay(weekly: PharmacyWeeklyHourRow[], weekday: number): PharmacyWeeklyHourRow[] {
  return weekly.filter((w) => w.weekday === weekday);
}

function buildDayLinesFromWeekly(
  weekly: PharmacyWeeklyHourRow[],
  weekday: number,
  opts?: { treatOpenFromMinutes?: number }
): string[] {
  const rows = weeklyForDay(weekly, weekday);
  if (!rows.length) return ["Horaires non renseignés"];

  const treatFrom = opts?.treatOpenFromMinutes ?? 0;
  const morning = rows.find((r) => r.period === "morning");
  const afternoon = rows.find((r) => r.period === "afternoon");

  const morningOpen = morning && !morning.is_closed ? parseTimeToMinutes(morning.opens_at) : null;
  const afternoonOpen =
    afternoon && !afternoon.is_closed ? parseTimeToMinutes(afternoon.opens_at) : null;

  const lines: string[] = [];

  const am = morning ? slotLabel(morning.opens_at, morning.closes_at, morning.is_closed) : null;
  if (am && morningOpen != null && morningOpen >= treatFrom) {
    lines.push(`Matin : ${am}`);
  }

  const pm = afternoon ? slotLabel(afternoon.opens_at, afternoon.closes_at, afternoon.is_closed) : null;
  if (pm && afternoonOpen != null && afternoonOpen >= treatFrom) {
    lines.push(`Après-midi : ${pm}`);
  }

  if (!am && afternoon?.is_closed && afternoonOpen != null && afternoonOpen >= treatFrom) {
    lines.push("Après-midi : fermé");
  }
  if (!pm && morning && !morning.is_closed && afternoon?.is_closed && afternoonOpen != null && afternoonOpen >= treatFrom) {
    lines.push("Après-midi : fermé");
  }

  if (lines.length === 0) {
    const anyOpenAfter =
      (morningOpen != null && morningOpen >= treatFrom && !morning?.is_closed) ||
      (afternoonOpen != null && afternoonOpen >= treatFrom && !afternoon?.is_closed);
    if (!anyOpenAfter && treatFrom === 0) lines.push("Fermé");
  }

  return lines;
}

function buildDayLinesFromOverride(o: PharmacyDayOverrideRow, opts?: { treatOpenFromMinutes?: number }): string[] {
  if (o.override_type === "closed" || o.override_type === "holiday") {
    const closedLabel = o.label?.trim()
      ? `${o.override_type === "holiday" ? "Férié" : "Fermé"} (${o.label.trim()})`
      : o.override_type === "holiday"
        ? "Férié"
        : "Fermé exceptionnellement";
    return [closedLabel];
  }
  const lines: string[] = [];
  if (o.label?.trim()) lines.push(o.label.trim());
  const am = slotLabel(o.morning_opens_at, o.morning_closes_at, false);
  const pm = slotLabel(o.afternoon_opens_at, o.afternoon_closes_at, false);
  const treatFrom = opts?.treatOpenFromMinutes ?? 0;
  const amOpen = parseTimeToMinutes(o.morning_opens_at);
  const pmOpen = parseTimeToMinutes(o.afternoon_opens_at);
  if (am && amOpen != null && amOpen >= treatFrom) lines.push(`Matin : ${am}`);
  if (pm && pmOpen != null && pmOpen >= treatFrom) lines.push(`Après-midi : ${pm}`);
  if (lines.length === 0) lines.push("Horaires spécifiques");
  return lines;
}

function buildPublicDayLines(
  dateIso: string,
  weekday: number,
  weekly: PharmacyWeeklyHourRow[],
  override: PharmacyDayOverrideRow | undefined,
  onCall: PharmacyOnCallPeriodRow[]
): { lines: string[]; isOnCallFullDay: boolean; isOnCallTailDay: boolean } {
  const fullPeriods = onCall.filter((p) => isGardeFullDisplayDay(p, dateIso));
  if (fullPeriods.length > 0) {
    return { lines: [gardeFullDayLine(fullPeriods)], isOnCallFullDay: true, isOnCallTailDay: false };
  }

  const tailEnd = gardeTailEndMinutesOnDate(onCall, dateIso);
  const treatFrom = tailEnd ?? 0;
  const lines: string[] = [];

  if (tailEnd != null) lines.push(gardeTailLine(tailEnd));

  const base = override
    ? buildDayLinesFromOverride(override, { treatOpenFromMinutes: treatFrom })
    : buildDayLinesFromWeekly(weekly, weekday, { treatOpenFromMinutes: treatFrom });

  for (const line of base) {
    if (tailEnd != null && (line === "Fermé" || line.startsWith("Fermé"))) continue;
    lines.push(line);
  }

  if (lines.length === 0 && tailEnd != null) {
    lines.push(gardeTailLine(tailEnd));
  }

  return {
    lines,
    isOnCallFullDay: false,
    isOnCallTailDay: tailEnd != null,
  };
}

/** Semaine en cours (lun → dim) — affichage public garde / horaires. */
export function buildCurrentWeekScheduleFr(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[]
): PharmacyDayScheduleLine[] {
  const now = nowInCasablanca();
  const todayIso = isoDateInCasablanca(now);
  const jsDay = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((jsDay + 6) % 7));

  const overrideByDate = new Map(overrides.map((o) => [o.day_date, o]));

  const out: PharmacyDayScheduleLine[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateIso = isoDateInCasablanca(d);
    const weekday = i + 1;
    const override = overrideByDate.get(dateIso);
    const { lines, isOnCallFullDay, isOnCallTailDay } = buildPublicDayLines(
      dateIso,
      weekday,
      weekly,
      override,
      onCall
    );

    out.push({
      dateIso,
      weekdayLabel: WEEKDAY_FR[weekday] ?? "",
      dateLabel: formatDateShortFr(dateIso),
      lines,
      isToday: dateIso === todayIso,
      isException: Boolean(override) && !isOnCallFullDay,
      isOnCallFullDay,
      isOnCallTailDay,
    });
  }
  return out;
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

/** Statut Ouverte/Fermée + badges garde (garde = ouvert pour le public entre starts_at et ends_at). */
export function resolvePharmacyOpenStatus(
  weekly: PharmacyWeeklyHourRow[],
  overrides: PharmacyDayOverrideRow[],
  onCall: PharmacyOnCallPeriodRow[]
): {
  status: PharmacyOpenStatus;
  openLabel: string;
  onCallNow: boolean;
  onCallToday: boolean;
} {
  const now = new Date();
  const todayIso = isoDateInCasablanca();
  const onCallNow = isOnCallNowAt(onCall, now);
  const onCallToday = isOnCallOnDate(onCall, todayIso);

  const minutes = minutesNowInCasablanca();
  const weekday = isoWeekdayInCasablanca();
  const override = overrides.find((o) => o.day_date === todayIso);

  let open = onCallNow;
  if (!open) {
    if (override) {
      const o = isOpenFromOverrideAt(override, minutes);
      open = o === true;
    } else {
      open = isOpenFromWeeklyAt(weekly, weekday, minutes);
    }
  }

  return {
    status: open ? "open" : "closed",
    openLabel: open ? "Ouverte" : "Fermée",
    onCallNow,
    onCallToday,
  };
}
