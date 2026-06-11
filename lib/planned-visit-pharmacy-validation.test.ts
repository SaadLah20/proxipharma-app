import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultMoroccoWeeklyHoursFixture,
  nextSundayIsoFrom,
  PLANNED_VISIT_MIN_LEAD_MINUTES,
  validatePlannedVisitAgainstPharmacy,
} from "./planned-visit-pharmacy-validation";

function casablancaNow(y: number, mo: number, d: number, h: number, mi: number): Date {
  return new Date(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00+01:00`);
}

describe("validatePlannedVisitAgainstPharmacy", () => {
  const weekly = defaultMoroccoWeeklyHoursFixture();
  const bundle = { weekly, overrides: [], onCall: [] };

  it("rejects visit time less than 30 minutes from now on same day", () => {
    const now = casablancaNow(2026, 6, 11, 14, 0);
    const result = validatePlannedVisitAgainstPharmacy(bundle, "2026-06-11", "14:15", now);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "too_soon");
  });

  it("accepts visit time at least 30 minutes from now in open slot", () => {
    const now = casablancaNow(2026, 6, 11, 14, 0);
    const result = validatePlannedVisitAgainstPharmacy(bundle, "2026-06-11", "14:30", now);
    assert.equal(result.ok, true);
  });

  it("rejects closed day (Sunday)", () => {
    const sunday = nextSundayIsoFrom("2026-06-11");
    const now = casablancaNow(2026, 6, 11, 10, 0);
    const result = validatePlannedVisitAgainstPharmacy(bundle, sunday, null, now);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "day_closed");
  });

  it("rejects time during lunch break on weekday", () => {
    const now = casablancaNow(2026, 6, 11, 9, 0);
    const result = validatePlannedVisitAgainstPharmacy(bundle, "2026-06-11", "14:00", now);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "time_closed");
  });

  it("accepts date-only on open weekday", () => {
    const now = casablancaNow(2026, 6, 11, 9, 0);
    const result = validatePlannedVisitAgainstPharmacy(bundle, "2026-06-12", "", now);
    assert.equal(result.ok, true);
  });

  it("accepts garde full day", () => {
    const now = casablancaNow(2026, 6, 11, 10, 0);
    const onCall = [
      {
        id: "g1",
        kind: "weekend_48h" as const,
        starts_at: "2026-06-11T08:00:00+01:00",
        ends_at: "2026-06-13T08:00:00+01:00",
        note: null,
      },
    ];
    const gardeBundle = { weekly, overrides: [], onCall };
    const result = validatePlannedVisitAgainstPharmacy(gardeBundle, "2026-06-11", "22:00", now);
    assert.equal(result.ok, true);
  });

  it("exports 30 minute lead constant", () => {
    assert.equal(PLANNED_VISIT_MIN_LEAD_MINUTES, 30);
  });
});
