/** Échéances passage / abandon auto — miroir SQL `_planned_visit_passage_at` / `_planned_visit_abandon_at`. */

import { dateOnlyAddDays } from "@/lib/planned-visit";

const CASABLANCA = "Africa/Casablanca";
/** Décalage pilote Maroc (aligné serveur Casablanca, sans DST côté client). */
const CASABLANCA_OFFSET = "+01:00";

function parseDateYmd(ymd: string | null | undefined): string | null {
  const d = String(ymd ?? "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function parseTimeHm(time: string | null | undefined): { h: number; mi: number } | null {
  const m = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi) || h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, mi };
}

function casablancaLocalMs(ymd: string, h: number, mi: number, s: number): number {
  const iso =
    `${ymd}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}${CASABLANCA_OFFSET}`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : NaN;
}

/** Instant passage (fin de journée J à 23:59:59 si pas d'heure). */
export function plannedVisitPassageAt(
  dateYmd: string | null | undefined,
  timeHmOrPg: string | null | undefined,
): Date | null {
  const ymd = parseDateYmd(dateYmd);
  if (!ymd) return null;
  const tm = parseTimeHm(timeHmOrPg);
  const ms = tm ? casablancaLocalMs(ymd, tm.h, tm.mi, 0) : casablancaLocalMs(ymd, 23, 59, 59);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

/** Instant abandon auto (fin J+1 à 23:59:59 sans heure ; passage + 24 h avec heure). */
export function plannedVisitAbandonAt(
  dateYmd: string | null | undefined,
  timeHmOrPg: string | null | undefined,
): Date | null {
  const ymd = parseDateYmd(dateYmd);
  if (!ymd) return null;
  const tm = parseTimeHm(timeHmOrPg);
  if (tm) {
    const passage = plannedVisitPassageAt(dateYmd, timeHmOrPg);
    if (!passage) return null;
    return new Date(passage.getTime() + 24 * 60 * 60 * 1000);
  }
  const jPlus1 = dateOnlyAddDays(ymd, 1);
  const ms = casablancaLocalMs(jPlus1, 23, 59, 59);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

export function plannedVisitAbandonWithinHours(
  dateYmd: string | null | undefined,
  timeHmOrPg: string | null | undefined,
  withinHours: number,
  now: Date = new Date(),
): boolean {
  const abandonAt = plannedVisitAbandonAt(dateYmd, timeHmOrPg);
  if (!abandonAt) return false;
  const ms = abandonAt.getTime() - now.getTime();
  return ms > 0 && ms <= withinHours * 60 * 60 * 1000;
}

export function plannedVisitPassageOverdue(
  dateYmd: string | null | undefined,
  timeHmOrPg: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const passageAt = plannedVisitPassageAt(dateYmd, timeHmOrPg);
  if (!passageAt) return false;
  return now.getTime() > passageAt.getTime();
}

export function formatPlannedVisitAbandonDeadlineFr(
  dateYmd: string | null | undefined,
  timeHmOrPg: string | null | undefined,
): string | null {
  const at = plannedVisitAbandonAt(dateYmd, timeHmOrPg);
  if (!at) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: CASABLANCA,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}
