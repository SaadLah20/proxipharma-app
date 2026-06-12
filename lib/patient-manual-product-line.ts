import type { PatientDemandeProduitsDraftLine } from "@/lib/patient-demande-produits-draft";
import { draftLineUnitPrice } from "@/lib/patient-demande-produits-draft";

export const PATIENT_MANUAL_LINE_ID_PREFIX = "manual:";

export function isManualDraftLine(line: Pick<PatientDemandeProduitsDraftLine, "catalog_source">): boolean {
  return line.catalog_source === "manual";
}

export function normalizeManualProductLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ");
}

export function createManualDraftLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${PATIENT_MANUAL_LINE_ID_PREFIX}${crypto.randomUUID()}`;
  }
  return `${PATIENT_MANUAL_LINE_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function draftLineKey(line: PatientDemandeProduitsDraftLine): string {
  if (isManualDraftLine(line)) {
    return `manual:${normalizeManualProductLabel(line.name).toLowerCase()}`;
  }
  return `${line.catalog_source ?? "global"}:${line.product_id}`;
}

export function draftCartCatalogTotal(lines: PatientDemandeProduitsDraftLine[]): number {
  return lines.reduce((sum, line) => {
    if (isManualDraftLine(line)) return sum;
    const pu = draftLineUnitPrice(line);
    return sum + (pu ?? 0) * line.qty;
  }, 0);
}

export function draftHasManualLines(lines: PatientDemandeProduitsDraftLine[]): boolean {
  return lines.some(isManualDraftLine);
}

export function buildManualRequestItemInsert(line: PatientDemandeProduitsDraftLine) {
  const cc = line.client_comment?.trim();
  return {
    line_product_kind: "patient_manual" as const,
    patient_requested_label: normalizeManualProductLabel(line.name),
    requested_qty: line.qty,
    line_source: "patient_request" as const,
    client_comment: cc && cc.length > 0 ? cc : null,
  };
}

export function buildResubmitItemPayload(line: PatientDemandeProduitsDraftLine) {
  const cc = line.client_comment?.trim();
  const base = {
    requested_qty: line.qty,
    ...(cc && cc.length > 0 ? { client_comment: cc.slice(0, 500) } : {}),
  };
  if (isManualDraftLine(line)) {
    return {
      ...base,
      line_product_kind: "patient_manual" as const,
      patient_requested_label: normalizeManualProductLabel(line.name),
    };
  }
  const isPharmacy = (line.catalog_source ?? "global") === "pharmacy";
  if (isPharmacy) {
    return {
      ...base,
      line_product_kind: "pharmacy" as const,
      pharmacy_product_id: line.product_id,
    };
  }
  return {
    ...base,
    line_product_kind: "global" as const,
    product_id: line.product_id,
  };
}

export function isUnresolvedManualRequestItem(row: {
  line_product_kind?: string | null;
  manual_resolved_at?: string | null;
}): boolean {
  return row.line_product_kind === "patient_manual" && row.manual_resolved_at == null;
}

export function manualRequestLineDisplayName(row: {
  line_product_kind?: string | null;
  patient_requested_label?: string | null;
  products?: { name?: string | null } | { name?: string | null }[] | null;
  pharmacy_catalog_products?: { name?: string | null } | { name?: string | null }[] | null;
}): string | null {
  if (row.line_product_kind === "patient_manual") {
    return row.patient_requested_label?.trim() || null;
  }
  return null;
}
