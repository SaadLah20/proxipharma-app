import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPlannedVisitUpdateGraceMax,
  daysBetweenIsoYmd,
  plannedVisitWindow,
  type VisitBoundLine,
} from "./planned-visit";

const noToOrderLine: VisitBoundLine = {
  capPositive: true,
  branch: "principal",
  principalAvail: "available",
  principalEta: null,
  alternatives: [],
};

const toOrderLine: VisitBoundLine = {
  capPositive: true,
  branch: "principal",
  principalAvail: "to_order",
  principalEta: "2026-06-15",
  alternatives: [],
};

describe("daysBetweenIsoYmd", () => {
  it("counts calendar days", () => {
    assert.equal(daysBetweenIsoYmd("2026-06-17", "2026-06-18"), 1);
    assert.equal(daysBetweenIsoYmd("2026-06-17", "2026-06-19"), 2);
    assert.equal(daysBetweenIsoYmd("2026-06-19", "2026-06-18"), -1);
  });
});

describe("applyPlannedVisitUpdateGraceMax", () => {
  it("does not extend when 2+ days remain", () => {
    const r = applyPlannedVisitUpdateGraceMax("2026-06-19", "2026-06-17");
    assert.equal(r.maxYmd, "2026-06-19");
    assert.equal(r.updateGraceApplied, false);
  });

  it("extends +2 when 1 day remains", () => {
    const r = applyPlannedVisitUpdateGraceMax("2026-06-18", "2026-06-17");
    assert.equal(r.maxYmd, "2026-06-20");
    assert.equal(r.updateGraceApplied, true);
  });

  it("extends +2 when normal max is past", () => {
    const r = applyPlannedVisitUpdateGraceMax("2026-06-18", "2026-06-19");
    assert.equal(r.maxYmd, "2026-06-20");
    assert.equal(r.updateGraceApplied, true);
  });
});

describe("plannedVisitWindow update context", () => {
  it("confirm keeps normal max (ETA + 3j)", () => {
    const win = plannedVisitWindow([toOrderLine], {
      context: "confirm",
      todayYmd: "2026-06-17",
    });
    assert.equal(win.maxNormalYmd, "2026-06-18");
    assert.equal(win.maxYmd, "2026-06-18");
    assert.equal(win.updateGraceApplied, false);
  });

  it("update extends when ≤ 1 day left on ETA + 3j", () => {
    const win = plannedVisitWindow([toOrderLine], {
      context: "update",
      todayYmd: "2026-06-17",
    });
    assert.equal(win.maxNormalYmd, "2026-06-18");
    assert.equal(win.maxYmd, "2026-06-20");
    assert.equal(win.updateGraceApplied, true);
  });

  it("update does not extend when 2+ days left without to_order", () => {
    const win = plannedVisitWindow([noToOrderLine], {
      context: "update",
      todayYmd: "2026-06-17",
    });
    assert.equal(win.maxNormalYmd, "2026-06-21");
    assert.equal(win.maxYmd, "2026-06-21");
    assert.equal(win.updateGraceApplied, false);
  });
});
