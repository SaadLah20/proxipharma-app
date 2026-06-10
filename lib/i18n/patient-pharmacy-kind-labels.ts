import type { RequestKindId } from "@/lib/request-kinds/types";
import { isRequestKindId } from "@/lib/request-kinds/registry";

const KIND_TO_WORKFLOW_KEY: Record<RequestKindId, "product" | "prescription" | "consultation"> = {
  product_request: "product",
  prescription: "prescription",
  free_consultation: "consultation",
};

/** Libellés types de dossier pour Mes pharmacies (workflow.*.label). */
export function patientPharmacyRequestKindLabels(
  kinds: string[],
  labelForKind: (kind: "product" | "prescription" | "consultation") => string,
  separator = " · ",
): string {
  const labels = kinds
    .filter(isRequestKindId)
    .map((k) => labelForKind(KIND_TO_WORKFLOW_KEY[k]));
  const unique = [...new Set(labels)];
  return unique.length > 0 ? unique.join(separator) : "—";
}
