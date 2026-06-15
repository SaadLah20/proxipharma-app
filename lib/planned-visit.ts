/** Bornes calendrier patient (fuseau Casablanca) pour `<input type="date">`, alignées serveur + 4j / dernier ETA+3j */

import { todayIsoCasablanca } from "@/lib/pharmacy-schedule-fr";

function isoDateParts(d: Date): { y: number; m: number; da: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, da: d.getDate() };
}

/** Aujourd’hui en Africa/Casablanca (YYYY-MM-DD). */
export function todayLocalIsoDate(): string {
  return todayIsoCasablanca();
}

/** Plafond calendrier « réception prévue » (défaut +5 ans). */
export function receptionDateMaxYmd(yearsAhead = 5): string {
  return dateOnlyAddDays(todayLocalIsoDate(), yearsAhead * 365);
}

/** Date ISO (YYYY-MM-DD) valide et ≥ aujourd’hui (calendrier local navigateur). */
export function isIsoDateOnOrAfterToday(ymd: string): boolean {
  const d = String(ymd).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d >= todayLocalIsoDate();
}

export const RECEPTION_DATE_BEFORE_TODAY_ERROR_FR =
  "La date de réception ne peut pas être antérieure à aujourd'hui.";

export function receptionDateBeforeTodayErrorFr(productLabel?: string): string {
  return productLabel
    ? `« ${productLabel} » : la date de réception ne peut pas être antérieure à aujourd'hui.`
    : RECEPTION_DATE_BEFORE_TODAY_ERROR_FR;
}

/** Lève si une date de réception « à commander » est strictement avant aujourd’hui. */
export function assertReceptionDateNotBeforeToday(ymd: string | null | undefined, productLabel?: string): void {
  const d = (ymd ?? "").trim().slice(0, 10);
  if (!d) return;
  if (!isIsoDateOnOrAfterToday(d)) {
    throw new Error(receptionDateBeforeTodayErrorFr(productLabel));
  }
}

export function dateOnlyAddDays(isoStart: string, days: number): string {
  const [yStr, moStr, dStr] = isoStart.split("-");
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = Number(dStr);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return isoStart;
  const x = new Date(y, mo - 1, d);
  x.setDate(x.getDate() + days);
  const p = isoDateParts(x);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.da).padStart(2, "0")}`;
}

export interface VisitBoundLine {
  capPositive: boolean;
  branch: null | "principal" | string;
  principalAvail: string | null;
  principalEta: string | null;
  alternatives: ReadonlyArray<{
    id: string;
    availability_status: string | null;
    expected_availability_date: string | null;
  }>;
}

export interface PlannedVisitWindow {
  minYmd: string;
  maxYmd: string;
  hasToOrder: boolean;
  maxEtaYmd: string | null;
  /** ETA manquante sur une ligne « à commander » sélectionnée (serveur refusera aussi) */
  missingEtaOnToOrder: boolean;
  /** Plafond avant grâce mise à jour (confirm / update sans extension). */
  maxNormalYmd: string;
  /** +2 j appliqués sur la mise à jour passage si ≤ 1 j restant sur maxNormalYmd. */
  updateGraceApplied: boolean;
}

export type PlannedVisitWindowContext = "confirm" | "update";

/** Jours calendaires entre deux dates ISO (to − from). */
export function daysBetweenIsoYmd(fromYmd: string, toYmd: string): number {
  const [fy, fm, fd] = fromYmd.split("-").map(Number);
  const [ty, tm, td] = toYmd.split("-").map(Number);
  if (![fy, fm, fd, ty, tm, td].every(Number.isFinite)) return 0;
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

export const PLANNED_VISIT_UPDATE_GRACE_THRESHOLD_DAYS = 2;
export const PLANNED_VISIT_UPDATE_GRACE_EXTENSION_DAYS = 2;

/** Mise à jour passage : +2 j si ≤ 1 j restant (ou dépassé) sur la borne normale. */
export function applyPlannedVisitUpdateGraceMax(
  maxNormalYmd: string,
  todayYmd: string = todayLocalIsoDate(),
): { maxYmd: string; updateGraceApplied: boolean } {
  const remaining = daysBetweenIsoYmd(todayYmd, maxNormalYmd);
  if (remaining >= PLANNED_VISIT_UPDATE_GRACE_THRESHOLD_DAYS) {
    return { maxYmd: maxNormalYmd, updateGraceApplied: false };
  }
  return {
    maxYmd: dateOnlyAddDays(maxNormalYmd, PLANNED_VISIT_UPDATE_GRACE_EXTENSION_DAYS),
    updateGraceApplied: true,
  };
}

/** Calcule fenêtre autorisable avant appel RPC (calendrier local patient). */
export function plannedVisitWindow(
  lines: VisitBoundLine[],
  options?: { context?: PlannedVisitWindowContext; todayYmd?: string },
): PlannedVisitWindow {
  const today = options?.todayYmd ?? todayLocalIsoDate();
  let hasToOrder = false;
  let maxEta: string | null = null;
  let missingEtaOnToOrder = false;

  for (const row of lines) {
    if (!row.capPositive || row.branch === null) continue;

    let av: string | null;
    let eta: string | null;

    if (row.branch === "principal") {
      av = row.principalAvail;
      eta = row.principalEta;
    } else {
      const alt = row.alternatives.find((a) => a.id === row.branch);
      if (!alt) continue;
      av = alt.availability_status;
      eta = alt.expected_availability_date ?? null;
    }

    if (av === "to_order") {
      hasToOrder = true;
      if (eta != null && String(eta).trim() !== "") {
        const e = String(eta).slice(0, 10);
        if (maxEta == null || e > maxEta) maxEta = e;
      } else {
        missingEtaOnToOrder = true;
      }
    }
  }

  const maxNormal = !hasToOrder
    ? dateOnlyAddDays(today, 4)
    : maxEta != null
      ? dateOnlyAddDays(maxEta, 3)
      : dateOnlyAddDays(today, 4);

  const grace =
    options?.context === "update"
      ? applyPlannedVisitUpdateGraceMax(maxNormal, today)
      : { maxYmd: maxNormal, updateGraceApplied: false };

  return {
    minYmd: today,
    maxYmd: grace.maxYmd,
    hasToOrder,
    maxEtaYmd: maxEta,
    missingEtaOnToOrder,
    maxNormalYmd: maxNormal,
    updateGraceApplied: grace.updateGraceApplied,
  };
}
