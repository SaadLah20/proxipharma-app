/** Regroupement lecture seule des lignes produit sur dossiers clôturés (patient + pharmacien). */

export type ClosedLinePartitionInput = {
  id: string;
  is_selected_by_patient: boolean;
  withdrawn_after_confirm?: boolean | null;
  counter_outcome?: string | null;
};

export type ClosedLinePartition<T extends ClosedLinePartitionInput> = {
  recuperes: T[];
  nonRetenues: T[];
  ecartes: T[];
  autresRetenus: T[];
};

export function partitionClosedRequestProductLines<T extends ClosedLinePartitionInput>(
  items: T[]
): ClosedLinePartition<T> {
  const recuperes = items.filter(
    (r) => r.is_selected_by_patient && (r.counter_outcome ?? "unset") === "picked_up"
  );
  const nonRetenues = items.filter((r) => !r.is_selected_by_patient);
  const ecartes = items.filter(
    (r) =>
      r.is_selected_by_patient &&
      Boolean(r.withdrawn_after_confirm) &&
      (r.counter_outcome ?? "unset") !== "picked_up"
  );
  const autresRetenus = items.filter(
    (r) =>
      r.is_selected_by_patient &&
      !r.withdrawn_after_confirm &&
      (r.counter_outcome ?? "unset") !== "picked_up"
  );
  return { recuperes, nonRetenues, ecartes, autresRetenus };
}
