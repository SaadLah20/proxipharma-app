import type { PatientLineLike } from "@/lib/patient-confirmed-line-buckets";

export type CounterClosureLine = {
  is_selected_by_patient: boolean;
  withdrawn_after_confirm?: boolean | null;
  counter_outcome?: string | null;
};

/** Lignes retenues actives (non écartées) pour le comptoir. */
export function pharmacistCounterTrackedLines<T extends CounterClosureLine>(items: T[]): T[] {
  return items.filter((i) => i.is_selected_by_patient && !i.withdrawn_after_confirm);
}

/** Aligné sur `pharmacist_complete_request_after_counter` : bloque seulement unset / report. */
export function pharmacistCounterUnresolvedLines<T extends CounterClosureLine>(tracked: T[]): T[] {
  return tracked.filter((i) => {
    const co = i.counter_outcome ?? "unset";
    return co === "unset" || co === "deferred_next_visit";
  });
}

/** Clôture possible dès qu’au moins une ligne retenue est marquée récupérée (les autres seront écartées à la clôture). */
export function pharmacistCanCompleteCounterClosure<T extends CounterClosureLine>(items: T[]): boolean {
  return pharmacistCounterPickedUpCount(items) > 0;
}

export function pharmacistCounterPickedUpCount<T extends CounterClosureLine>(items: T[]): number {
  return pharmacistCounterTrackedLines(items).filter((i) => (i.counter_outcome ?? "unset") === "picked_up")
    .length;
}
