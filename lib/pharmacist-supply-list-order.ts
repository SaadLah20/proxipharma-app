import {
  bucketPatientValidatedLinesThreeWays,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";

export type PharmacistSupplySectionKey = "dispo" | "commander" | "hors" | "ecart";

const SECTION_TITLES: Record<PharmacistSupplySectionKey, (count: number) => string> = {
  dispo: (n) => `À réserver (validé · ${n})`,
  commander: (n) => `À commander (validé · ${n})`,
  hors: (n) => `Hors bloc principal (${n})`,
  ecart: (n) => `Écart après validation (${n})`,
};

/** Clé de section pour une ligne (sans réordonner la liste). */
export function pharmacistSupplySectionKey<T extends PatientLineLike>(row: T): PharmacistSupplySectionKey {
  const b = bucketPatientValidatedLinesThreeWays([row]);
  if (b.retireesApresValidation.some((r) => r.id === row.id)) return "ecart";
  if (b.dispoOfficine.some((r) => r.id === row.id)) return "dispo";
  if (b.aCommander.some((r) => r.id === row.id)) return "commander";
  return "hors";
}

/** Conserve l’ordre d’entrée (ex. `created_at`) ; en-têtes de section uniquement quand la section change. */
export function flattenPharmacistSupplyListEntriesStable<T extends PatientLineLike>(
  rows: T[]
): { header: string | null; row: T }[] {
  const counts: Record<PharmacistSupplySectionKey, number> = {
    dispo: 0,
    commander: 0,
    hors: 0,
    ecart: 0,
  };
  for (const row of rows) counts[pharmacistSupplySectionKey(row)] += 1;

  const out: { header: string | null; row: T }[] = [];
  let lastKey: PharmacistSupplySectionKey | null = null;
  for (const row of rows) {
    const key = pharmacistSupplySectionKey(row);
    const header = key !== lastKey ? SECTION_TITLES[key](counts[key]) : null;
    lastKey = key;
    out.push({ header, row });
  }
  return out;
}
