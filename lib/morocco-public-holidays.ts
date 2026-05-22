/**
 * Jours fériés Maroc — calendrier pilote (une date par fête).
 * Fêtes à dates variables (Aid, etc.) : on retient la **première** date du créneau annoncé ;
 * l’admin pourra ajuster chaque année plus tard.
 */

export type MoroccoPublicHoliday = {
  id: string;
  labelFr: string;
  dateIso: string;
  /** Plusieurs dates possibles annoncées — date retenue = première en attendant l’admin. */
  uncertainDate?: boolean;
};

const FIXED_BY_MONTH_DAY: { id: string; labelFr: string; month: number; day: number }[] = [
  { id: "new-year", labelFr: "Nouvel An", month: 1, day: 1 },
  { id: "independence-manifesto", labelFr: "Manifeste de l'Indépendance", month: 1, day: 11 },
  { id: "amazigh-new-year", labelFr: "Nouvel An amazigh (Yennayer)", month: 1, day: 13 },
  { id: "labour-day", labelFr: "Fête du Travail", month: 5, day: 1 },
  { id: "throne-day", labelFr: "Fête du Trône", month: 7, day: 30 },
  { id: "oued-ed-dahab", labelFr: "Récupération de Oued Ed-Dahab", month: 8, day: 14 },
  { id: "revolution-day", labelFr: "Révolution du Roi et du Peuple", month: 8, day: 20 },
  { id: "youth-day", labelFr: "Fête de la Jeunesse", month: 8, day: 21 },
  { id: "green-march", labelFr: "Marche Verte", month: 11, day: 6 },
  { id: "independence-day", labelFr: "Fête de l'Indépendance", month: 11, day: 18 },
];

const ISLAMIC_BY_YEAR: Record<number, { id: string; labelFr: string; dates: string[] }[]> = {
  2025: [
    { id: "eid-fitr", labelFr: "Aid al-Fitr", dates: ["2025-03-30", "2025-03-31"] },
    { id: "eid-adha", labelFr: "Aid al-Adha", dates: ["2025-06-06", "2025-06-07"] },
    { id: "mawlid", labelFr: "Mawlid", dates: ["2025-09-04"] },
    { id: "ashura", labelFr: "Achoura", dates: ["2025-07-05"] },
  ],
  2026: [
    { id: "eid-fitr", labelFr: "Aid al-Fitr", dates: ["2026-03-19", "2026-03-20"] },
    { id: "eid-adha", labelFr: "Aid al-Adha", dates: ["2026-05-26", "2026-05-27"] },
    { id: "mawlid", labelFr: "Mawlid", dates: ["2026-08-25"] },
    { id: "ashura", labelFr: "Achoura", dates: ["2026-06-25"] },
  ],
  2027: [
    { id: "eid-fitr", labelFr: "Aid al-Fitr", dates: ["2027-03-09", "2027-03-10"] },
    { id: "eid-adha", labelFr: "Aid al-Adha", dates: ["2027-05-16", "2027-05-17"] },
    { id: "mawlid", labelFr: "Mawlid", dates: ["2027-08-14"] },
    { id: "ashura", labelFr: "Achoura", dates: ["2027-06-15"] },
  ],
  2028: [
    { id: "eid-fitr", labelFr: "Aid al-Fitr", dates: ["2028-02-26", "2028-02-27"] },
    { id: "eid-adha", labelFr: "Aid al-Adha", dates: ["2028-05-05", "2028-05-06"] },
  ],
};

function buildCanonicalHolidays(): MoroccoPublicHoliday[] {
  const out: MoroccoPublicHoliday[] = [];
  const years = [2025, 2026, 2027, 2028];

  for (const year of years) {
    for (const f of FIXED_BY_MONTH_DAY) {
      out.push({
        id: `${f.id}-${year}`,
        labelFr: f.labelFr,
        dateIso: `${year}-${String(f.month).padStart(2, "0")}-${String(f.day).padStart(2, "0")}`,
      });
    }
    const islamic = ISLAMIC_BY_YEAR[year];
    if (islamic) {
      for (const entry of islamic) {
        const dateIso = entry.dates[0];
        out.push({
          id: `${entry.id}-${year}`,
          labelFr: entry.labelFr,
          dateIso,
          uncertainDate: entry.dates.length > 1,
        });
      }
    }
  }

  return out.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
}

const CANONICAL_HOLIDAYS = buildCanonicalHolidays();

const BY_DATE = new Map<string, MoroccoPublicHoliday>(
  CANONICAL_HOLIDAYS.map((h) => [h.dateIso, h])
);

export function findMoroccoHolidayOnDate(dateIso: string): MoroccoPublicHoliday | undefined {
  return BY_DATE.get(dateIso);
}

/** Fêtes à partir d’une date (une entrée par jour férié calendaire). */
export function moroccoPublicHolidaysFromDate(fromDateIso: string): MoroccoPublicHoliday[] {
  return CANONICAL_HOLIDAYS.filter((h) => h.dateIso >= fromDateIso);
}

/** @deprecated Utiliser findMoroccoHolidayOnDate */
export function findMoroccoHolidayById(id: string): MoroccoPublicHoliday | undefined {
  return CANONICAL_HOLIDAYS.find((h) => h.id === id);
}
