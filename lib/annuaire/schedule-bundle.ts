import { resolvePharmacyOpenStatus } from "@/lib/pharmacy-schedule-fr";
import type {
  PharmacyDayOverrideRow,
  PharmacyOnCallPeriodRow,
  PharmacyWeeklyHourRow,
} from "@/lib/pharmacy-profile-types";
import { supabase } from "@/lib/supabase";

export type PharmacyScheduleBundle = {
  weekly: PharmacyWeeklyHourRow[];
  overrides: PharmacyDayOverrideRow[];
  onCall: PharmacyOnCallPeriodRow[];
};

export type PharmacyOpenSnapshot = ReturnType<typeof resolvePharmacyOpenStatus>;

function weekBoundsCasablanca(): { start: string; end: string } {
  const today = new Date();
  const weekStart = new Date(today);
  const js = today.getDay();
  weekStart.setDate(today.getDate() - ((js + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  };
}

/** Charge horaires / gardes pour un lot d’officines (annuaire). */
export async function loadScheduleBundlesByPharmacyIds(
  pharmacyIds: string[]
): Promise<Map<string, PharmacyScheduleBundle>> {
  const map = new Map<string, PharmacyScheduleBundle>();
  if (pharmacyIds.length === 0) return map;

  const { start, end } = weekBoundsCasablanca();
  const sinceOnCall = new Date(Date.now() - 14 * 86400000).toISOString();

  const [whRes, ovRes, ocRes] = await Promise.all([
    supabase
      .from("pharmacy_weekly_hours")
      .select("pharmacy_id,weekday,period,opens_at,closes_at,is_closed")
      .in("pharmacy_id", pharmacyIds),
    supabase
      .from("pharmacy_day_overrides")
      .select(
        "pharmacy_id,id,day_date,override_type,label,morning_opens_at,morning_closes_at,afternoon_opens_at,afternoon_closes_at"
      )
      .in("pharmacy_id", pharmacyIds)
      .gte("day_date", start)
      .lte("day_date", end),
    supabase
      .from("pharmacy_on_call_periods")
      .select("pharmacy_id,id,kind,starts_at,ends_at,note")
      .in("pharmacy_id", pharmacyIds)
      .gte("ends_at", sinceOnCall),
  ]);

  for (const id of pharmacyIds) {
    map.set(id, { weekly: [], overrides: [], onCall: [] });
  }

  for (const row of (whRes.data ?? []) as (PharmacyWeeklyHourRow & { pharmacy_id: string })[]) {
    const b = map.get(row.pharmacy_id);
    if (b) b.weekly.push(row);
  }
  for (const row of (ovRes.data ?? []) as (PharmacyDayOverrideRow & { pharmacy_id: string })[]) {
    const b = map.get(row.pharmacy_id);
    if (b) b.overrides.push(row);
  }
  for (const row of (ocRes.data ?? []) as (PharmacyOnCallPeriodRow & { pharmacy_id: string })[]) {
    const b = map.get(row.pharmacy_id);
    if (b) b.onCall.push(row);
  }

  return map;
}

export function openSnapshotForBundle(bundle: PharmacyScheduleBundle | undefined): PharmacyOpenSnapshot {
  if (!bundle) {
    return { status: "closed", openLabel: "Fermée", onCallNow: false, onCallToday: false };
  }
  return resolvePharmacyOpenStatus(bundle.weekly, bundle.overrides, bundle.onCall);
}
