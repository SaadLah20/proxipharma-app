/** Jours fériés Maroc (liste pilote — dates fixes + islamiques par année ; admin les gérera plus tard). */

export type MoroccoPublicHoliday = {
  id: string;
  labelFr: string;
  dateIso: string;
};

const FIXED_BY_MONTH_DAY: { id: string; labelFr: string; month: number; day: number }[] = [
  { id: "new-year", labelFr: "Nouvel An", month: 1, day: 1 },
  { id: "independence-manifesto", labelFr: "Manifeste de l'Indépendance", month: 1, day: 11 },
  { id: "amazigh-new-year", labelFr: "Nouvel An amazigh (Yennayer)", month: 1, day: 13 },
  { id: "labour-day", labelFr: "Fête du Travail", month: 5, day: 1 },
  { id: "throne-day", labelFr: "Fête du Trône", month: 7, day: 30 },
  { id: "oued-ed-dahab", labelFr: "Anniversaire de la Récupération de Oued Ed-Dahab", month: 8, day: 14 },
  { id: "revolution-day", labelFr: "Anniversaire de la Révolution du Roi et du Peuple", month: 8, day: 20 },
  { id: "youth-day", labelFr: "Fête de la Jeunesse", month: 8, day: 21 },
  { id: "green-march", labelFr: "Anniversaire de la Marche Verte", month: 11, day: 6 },
  { id: "independence-day", labelFr: "Fête de l'Indépendance", month: 11, day: 18 },
];

/** Dates islamiques (approx. calendrier officiel — à affiner via admin plus tard). */
const ISLAMIC_BY_YEAR: Record<number, { id: string; labelFr: string; dates: string[] }[]> = {
  2025: [
    { id: "eid-fitr-2025", labelFr: "Aid al-Fitr", dates: ["2025-03-30", "2025-03-31"] },
    { id: "eid-adha-2025", labelFr: "Aid al-Adha", dates: ["2025-06-06", "2025-06-07"] },
    { id: "mawlid-2025", labelFr: "Naissance du Prophète (Mawlid)", dates: ["2025-09-04"] },
    { id: "ashura-2025", labelFr: "Achoura", dates: ["2025-07-05"] },
  ],
  2026: [
    { id: "eid-fitr-2026", labelFr: "Aid al-Fitr", dates: ["2026-03-19", "2026-03-20"] },
    { id: "eid-adha-2026", labelFr: "Aid al-Adha", dates: ["2026-05-26", "2026-05-27"] },
    { id: "mawlid-2026", labelFr: "Naissance du Prophète (Mawlid)", dates: ["2026-08-25"] },
    { id: "ashura-2026", labelFr: "Achoura", dates: ["2026-06-25"] },
  ],
  2027: [
    { id: "eid-fitr-2027", labelFr: "Aid al-Fitr", dates: ["2027-03-09", "2027-03-10"] },
    { id: "eid-adha-2027", labelFr: "Aid al-Adha", dates: ["2027-05-16", "2027-05-17"] },
    { id: "mawlid-2027", labelFr: "Naissance du Prophète (Mawlid)", dates: ["2027-08-14"] },
    { id: "ashura-2027", labelFr: "Achoura", dates: ["2027-06-15"] },
  ],
};

function buildAllHolidays(): MoroccoPublicHoliday[] {
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
        entry.dates.forEach((dateIso, i) => {
          const suffix = entry.dates.length > 1 ? ` (jour ${i + 1})` : "";
          out.push({
            id: `${entry.id}-d${i + 1}`,
            labelFr: `${entry.labelFr}${suffix}`,
            dateIso,
          });
        });
      }
    }
  }

  return out.sort((a, b) => a.dateIso.localeCompare(b.dateIso) || a.labelFr.localeCompare(b.labelFr));
}

const ALL_HOLIDAYS = buildAllHolidays();

/** Fêtes à partir d'une date (inclus), triées par date. */
export function moroccoPublicHolidaysFromDate(fromDateIso: string): MoroccoPublicHoliday[] {
  return ALL_HOLIDAYS.filter((h) => h.dateIso >= fromDateIso);
}

export function findMoroccoHolidayById(id: string): MoroccoPublicHoliday | undefined {
  return ALL_HOLIDAYS.find((h) => h.id === id);
}
