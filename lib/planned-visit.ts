/** Bornes locale (navigateur) pour `<input type="date">`, alignées règle serveur Morocco + 4j / dernier ETA+3j */

function isoDateParts(d: Date): { y: number; m: number; da: number } {
  return { y: d.getFullYear(), m: d.getMonth() + 1, da: d.getDate() };
}

export function todayLocalIsoDate(): string {
  const { y, m, da } = isoDateParts(new Date());
  return `${y}-${String(m).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
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
}

/** Calcule fenêtre autorisable avant appel RPC (calendrier local patient). */
export function plannedVisitWindow(lines: VisitBoundLine[]): PlannedVisitWindow {
  const today = todayLocalIsoDate();
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

  const maxEnd = !hasToOrder
    ? dateOnlyAddDays(today, 4)
    : maxEta != null
      ? dateOnlyAddDays(maxEta, 3)
      : dateOnlyAddDays(today, 4);

  return {
    minYmd: today,
    maxYmd: maxEnd,
    hasToOrder,
    maxEtaYmd: maxEta,
    missingEtaOnToOrder,
  };
}
