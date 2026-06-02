import {
  bucketPatientValidatedLinesThreeWays,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";

export type PharmacistSupplySectionKey = "dispo" | "commander" | "nonRetenus" | "hors" | "ecart";

const SECTION_ORDER: PharmacistSupplySectionKey[] = ["dispo", "commander", "nonRetenus", "hors", "ecart"];

const SECTION_TITLES: Record<PharmacistSupplySectionKey, (count: number) => string> = {
  dispo: (n) => `À réserver (validé · ${n})`,
  commander: (n) => `À commander (validé · ${n})`,
  nonRetenus: (n) => `Non retenus à la validation (${n})`,
  hors: (n) => `Hors bloc principal (${n})`,
  ecart: (n) => `Retrait après validation (${n})`,
};

/** Clé de section pour une ligne (sans réordonner la liste). */
export function pharmacistSupplySectionKey<T extends PatientLineLike>(row: T): PharmacistSupplySectionKey {
  if (!row.is_selected_by_patient && !row.withdrawn_after_confirm) return "nonRetenus";
  const b = bucketPatientValidatedLinesThreeWays([row]);
  if (b.retireesApresValidation.some((r) => r.id === row.id)) return "ecart";
  if (b.dispoOfficine.some((r) => r.id === row.id)) return "dispo";
  if (b.aCommander.some((r) => r.id === row.id)) return "commander";
  return "hors";
}

/** Trie par bloc métier (réserver → commander → hors → écart), ordre stable à l’intérieur d’un bloc. */
export function sortPharmacistSupplyRowsBySection<T extends PatientLineLike>(rows: T[]): T[] {
  const orderOf = (key: PharmacistSupplySectionKey) => SECTION_ORDER.indexOf(key);
  return rows
    .map((row, index) => ({ row, index, key: pharmacistSupplySectionKey(row) }))
    .sort((a, b) => orderOf(a.key) - orderOf(b.key) || a.index - b.index)
    .map((x) => x.row);
}

/** Conserve l’ordre d’entrée ; en-têtes de section uniquement quand la section change. */
export function flattenPharmacistSupplyListEntriesStable<T extends PatientLineLike>(
  rows: T[]
): { header: string | null; row: T }[] {
  const counts: Record<PharmacistSupplySectionKey, number> = {
    dispo: 0,
    commander: 0,
    nonRetenus: 0,
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
