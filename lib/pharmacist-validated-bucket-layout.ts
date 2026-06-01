import {
  bucketPatientValidatedLinesThreeWays,
  validatedBranchUnitPriceMad,
  validatedQtyForPatientLine,
  type PatientLineLike,
} from "@/lib/patient-confirmed-line-buckets";
import type { PharmacyPricingConfig } from "@/lib/pharmacy-pricing/types";

export type PharmacistValidatedBucketKind =
  | "sky_reserve"
  | "teal_order"
  | "amber_hors"
  | "red_ecart"
  | "sky_nonretenus";

export type PharmacistValidatedBucketGroup<T extends PatientLineLike> = {
  kind: PharmacistValidatedBucketKind;
  title: string;
  totalLabel?: string;
  hint?: string;
  rows: T[];
  collapsible?: boolean;
};

function monetaryTotalsForRetainedLines(
  rows: PatientLineLike[],
  requestStatus: string,
  pricingConfig?: PharmacyPricingConfig | null
): { count: number; sumKnown: number; missingPrice: boolean } {
  let sumKnown = 0;
  let missingPrice = false;
  let count = 0;
  for (const row of rows) {
    if (!row.is_selected_by_patient || row.withdrawn_after_confirm) continue;
    count += 1;
    const unit = validatedBranchUnitPriceMad(row, pricingConfig);
    const qty = validatedQtyForPatientLine(row);
    if (unit == null) missingPrice = true;
    else sumKnown += unit * qty;
  }
  return { count, sumKnown, missingPrice };
}

export function compactTotalMadLabel(t: {
  sumKnown: number;
  missingPrice: boolean;
  empty: boolean;
}): string {
  if (t.empty) return "—";
  if (t.missingPrice && t.sumKnown === 0) return "Total —";
  if (t.missingPrice) return `Total · ${t.sumKnown.toFixed(2)} MAD · partiel`;
  return `Total · ${t.sumKnown.toFixed(2)} MAD`;
}

/** Sections sky / teal alignées sur le parcours patient (demande validée ou traitée). */
export function buildPharmacistValidatedBucketGroups<T extends PatientLineLike>(
  items: T[],
  requestStatus: string,
  pricingConfig?: PharmacyPricingConfig | null
): PharmacistValidatedBucketGroup<T>[] {
  const { dispoOfficine, aCommander, horsPerimetre, retireesApresValidation } =
    bucketPatientValidatedLinesThreeWays(items);
  const dispoRetenues = dispoOfficine.filter((r) => r.is_selected_by_patient);
  const aCommanderRetenues = aCommander.filter((r) => r.is_selected_by_patient);
  const horsPerimetreRetenues = horsPerimetre.filter((r) => r.is_selected_by_patient);
  const lignesNonRetenues = items.filter((r) => !r.is_selected_by_patient);
  const isTreated = requestStatus === "treated";
  const groups: PharmacistValidatedBucketGroup<T>[] = [];

  if (dispoRetenues.length > 0) {
    const sub = monetaryTotalsForRetainedLines(dispoRetenues, requestStatus, pricingConfig);
    groups.push({
      kind: "sky_reserve",
      title: isTreated ? "Réservés — passage en attente" : "À réserver",
      totalLabel: compactTotalMadLabel({
        sumKnown: sub.sumKnown,
        missingPrice: sub.missingPrice,
        empty: sub.count < 1,
      }),
      rows: dispoRetenues,
    });
  }

  if (aCommanderRetenues.length > 0) {
    const sub = monetaryTotalsForRetainedLines(aCommanderRetenues, requestStatus, pricingConfig);
    groups.push({
      kind: "teal_order",
      title: isTreated ? "Commandés pour le patient" : "À commander",
      totalLabel: compactTotalMadLabel({
        sumKnown: sub.sumKnown,
        missingPrice: sub.missingPrice,
        empty: sub.count < 1,
      }),
      rows: aCommanderRetenues,
    });
  }

  if (horsPerimetreRetenues.length > 0) {
    groups.push({
      kind: "amber_hors",
      title: "Point d'attention",
      hint: "À confirmer avec le patient si besoin.",
      rows: horsPerimetreRetenues,
    });
  }

  if (retireesApresValidation.length > 0) {
    groups.push({
      kind: "red_ecart",
      title: "Écart après validation",
      hint: "Retrait convenu avec le patient — trace conservée.",
      rows: retireesApresValidation,
      collapsible: true,
    });
  }

  if (lignesNonRetenues.length > 0) {
    groups.push({
      kind: "sky_nonretenus",
      title: "Lignes non retenues",
      rows: lignesNonRetenues,
      collapsible: true,
    });
  }

  return groups;
}

export function supplyTierForBucketKind(
  kind: PharmacistValidatedBucketKind
): "dispo_officine" | "commande" | "hors_perimetre" | "retire_apres_validation" {
  switch (kind) {
    case "teal_order":
      return "commande";
    case "amber_hors":
      return "hors_perimetre";
    case "red_ecart":
      return "retire_apres_validation";
    default:
      return "dispo_officine";
  }
}
