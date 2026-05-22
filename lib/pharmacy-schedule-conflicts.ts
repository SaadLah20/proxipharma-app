import type { PharmacyDayOverrideRow, PharmacyOnCallPeriodRow } from "@/lib/pharmacy-profile-types";

const TZ = "Africa/Casablanca";

export function todayDateIsoCasablanca(): string {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function periodStartDateIso(p: Pick<PharmacyOnCallPeriodRow, "starts_at">): string {
  const d = new Date(p.starts_at);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function periodEndDateIso(p: Pick<PharmacyOnCallPeriodRow, "ends_at">): string {
  const d = new Date(p.ends_at);
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  const y = local.getFullYear();
  const m = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dateIsoInRange(dateIso: string, startIso: string, endIso: string): boolean {
  return dateIso >= startIso && dateIso <= endIso;
}

export function onCallCoversDate(
  onCall: Pick<PharmacyOnCallPeriodRow, "starts_at" | "ends_at">[],
  dateIso: string
): boolean {
  return onCall.some((p) => dateIsoInRange(dateIso, periodStartDateIso(p), periodEndDateIso(p)));
}

/** Toutes les dates calendaires touchées par une garde (début → fin inclus). */
export function eachCalendarDateInOnCall(
  startsAtIso: string,
  endsAtIso: string
): string[] {
  const start = periodStartDateIso({ starts_at: startsAtIso });
  const end = periodEndDateIso({ ends_at: endsAtIso });
  const out: string[] = [];
  const [sy, sm, sd] = start.split("-").map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const endDate = new Date(end.split("-").map(Number)[0], Number(end.split("-")[1]) - 1, Number(end.split("-")[2]));

  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function overridesOnOnCallDates(
  overrides: PharmacyDayOverrideRow[],
  startsAtIso: string,
  endsAtIso: string
): PharmacyDayOverrideRow[] {
  const dates = new Set(eachCalendarDateInOnCall(startsAtIso, endsAtIso));
  return overrides.filter((o) => dates.has(o.day_date));
}

export function canPlanOverrideOnDate(
  onCall: Pick<PharmacyOnCallPeriodRow, "starts_at" | "ends_at">[],
  dateIso: string
): { ok: true } | { ok: false; reason: string } {
  if (onCallCoversDate(onCall, dateIso)) {
    return {
      ok: false,
      reason:
        "Cette date est déjà couverte par une garde. Retirez la garde ou choisissez un autre jour.",
    };
  }
  return { ok: true };
}
