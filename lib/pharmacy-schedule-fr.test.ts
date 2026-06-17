import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeOnCallPeriod } from "./pharmacy-on-call-compute.ts";
import type { PharmacyOnCallPeriodRow } from "./pharmacy-profile-types.ts";
import {
  buildCurrentWeekSchedule,
  isPharmacyOpenAt,
  resolvePharmacyOpenStatus,
} from "./pharmacy-schedule-fr.ts";

const emptyWeekly: never[] = [];
const emptyOverrides: never[] = [];

function periodFromCompute(kind: "holiday_24h" | "weekday_24h" | "weekend_48h", startDateIso: string): PharmacyOnCallPeriodRow {
  const computed = computeOnCallPeriod(kind, startDateIso);
  return {
    id: `test-${startDateIso}-${kind}`,
    kind,
    starts_at: computed.startsAtIso,
    ends_at: computed.endsAtIso,
    note: null,
  };
}

function casablancaInstant(ymd: string, hm: string): Date {
  const [hh, mm] = hm.split(":").map(Number);
  return new Date(
    `${ymd}T${String(hh).padStart(2, "0")}:${String(mm ?? 0).padStart(2, "0")}:00+01:00`,
  );
}

describe("resolvePharmacyOpenStatus — jour de début de garde", () => {
  const onCall = [periodFromCompute("holiday_24h", "2026-06-17")];

  it("à 1h20 : fermée, garde à venir à 9h", () => {
    const at = casablancaInstant("2026-06-17", "01:20");
    const status = resolvePharmacyOpenStatus(emptyWeekly, emptyOverrides, onCall, at, "fr");
    assert.equal(status.status, "closed");
    assert.equal(status.onCallNow, false);
    assert.equal(status.onCallUpcomingToday, true);
    assert.equal(status.onCallUpcomingFromLabel, "09h00");
    assert.equal(status.onCallBadgeVisible, false);
  });

  it("à 10h : ouverte, garde en cours", () => {
    const at = casablancaInstant("2026-06-17", "10:00");
    const status = resolvePharmacyOpenStatus(emptyWeekly, emptyOverrides, onCall, at, "fr");
    assert.equal(status.status, "open");
    assert.equal(status.onCallNow, true);
    assert.equal(status.onCallUpcomingToday, false);
    assert.equal(status.onCallBadgeVisible, true);
  });
});

describe("buildCurrentWeekSchedule — libellés garde", () => {
  it("jour de début : Garde à partir de 9h00", () => {
    const onCall = [periodFromCompute("holiday_24h", "2026-06-17")];
    const at = casablancaInstant("2026-06-17", "01:20");
    const days = buildCurrentWeekSchedule(emptyWeekly, emptyOverrides, onCall, "fr", at);
    const today = days.find((d) => d.isToday);
    assert.ok(today);
    assert.equal(today.isOnCallStartDay, true);
    assert.equal(today.isOnCallFullDay, false);
    assert.match(today.lines[0] ?? "", /à partir de 09h00/i);
    assert.match(today.lines[0] ?? "", /jour férié/i);
  });

  it("jour de fin : Garde jusqu'à 9h00", () => {
    const onCall = [periodFromCompute("weekday_24h", "2026-06-17")];
    const at = casablancaInstant("2026-06-18", "07:00");
    const days = buildCurrentWeekSchedule(emptyWeekly, emptyOverrides, onCall, "fr", at);
    const today = days.find((d) => d.isToday);
    assert.ok(today);
    assert.equal(today.isOnCallTailDay, true);
    assert.match(today.lines[0] ?? "", /jusqu'à 09h00/i);
  });

  it("jour milieu garde 48h : journée entière", () => {
    const onCall = [periodFromCompute("weekend_48h", "2026-06-13")];
    const at = casablancaInstant("2026-06-14", "12:00");
    const days = buildCurrentWeekSchedule(emptyWeekly, emptyOverrides, onCall, "fr", at);
    const today = days.find((d) => d.isToday);
    assert.ok(today);
    assert.equal(today.isOnCallFullDay, true);
    assert.match(today.lines[0] ?? "", /journée entière/i);
  });
});

describe("isPharmacyOpenAt — jour de début avant 9h", () => {
  it("retourne false à 1h20 le jour de début", () => {
    const onCall = [periodFromCompute("holiday_24h", "2026-06-17")];
    const open = isPharmacyOpenAt(emptyWeekly, emptyOverrides, onCall, "2026-06-17", 80);
    assert.equal(open, false);
  });

  it("retourne true à 10h le jour de début", () => {
    const onCall = [periodFromCompute("holiday_24h", "2026-06-17")];
    const open = isPharmacyOpenAt(emptyWeekly, emptyOverrides, onCall, "2026-06-17", 600);
    assert.equal(open, true);
  });

  it("jour milieu 48h : ouvert toute la journée", () => {
    const onCall = [periodFromCompute("weekend_48h", "2026-06-13")];
    assert.equal(isPharmacyOpenAt(emptyWeekly, emptyOverrides, onCall, "2026-06-14", 60), true);
    assert.equal(isPharmacyOpenAt(emptyWeekly, emptyOverrides, onCall, "2026-06-14", 1200), true);
  });
});

describe("resolvePharmacyOpenStatus — queue de garde", () => {
  it("à 7h le jour de fin : garde en cours (queue)", () => {
    const onCall = [periodFromCompute("weekday_24h", "2026-06-17")];
    const at = casablancaInstant("2026-06-18", "07:00");
    const status = resolvePharmacyOpenStatus(emptyWeekly, emptyOverrides, onCall, at, "fr");
    assert.equal(status.onCallNow, true);
    assert.equal(status.onCallUpcomingToday, false);
    assert.equal(status.status, "open");
  });
});
