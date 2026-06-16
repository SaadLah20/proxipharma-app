export type CatalogProductReportStatus =
  | "open"
  | "awaiting_pharmacist"
  | "reopened"
  | "closed"
  | "cancelled";

export type CatalogProductReportFieldKey =
  | "name"
  | "product_type"
  | "price_pph"
  | "price_ppv"
  | "brand"
  | "laboratory"
  | "form"
  | "category"
  | "subcategory"
  | "photo_url"
  | "short_description"
  | "full_description"
  | "usage"
  | "advice";

export type CatalogProductReportFieldInput = {
  field_key: CatalogProductReportFieldKey;
  current_value: string | null;
  suggested_value: string;
  applied_value?: string | null;
};

export type CatalogProductReportSnapshot = Record<string, unknown> & {
  id?: string;
  name?: string;
  product_type?: string;
};

export type CatalogProductReportListRow = {
  id: string;
  product_id: string;
  product_name: string;
  status: CatalogProductReportStatus;
  field_summary: string;
  created_at: string;
  updated_at: string;
};

export type CatalogProductReportEvent = {
  id: string;
  event_type: string;
  actor_id: string | null;
  body: string | null;
  created_at: string;
};

export type CatalogProductReportDetail = {
  id: string;
  product_id: string;
  product_name: string;
  status: CatalogProductReportStatus;
  product_snapshot: CatalogProductReportSnapshot;
  fields: CatalogProductReportFieldInput[];
  events: CatalogProductReportEvent[];
  latest_admin_message: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type ActiveCatalogProductReportSummary = {
  product_id: string;
  report_id: string;
  status: CatalogProductReportStatus;
};

export type AdminCatalogProductReportListRow = {
  id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_ville: string;
  product_id: string;
  product_name: string;
  status: CatalogProductReportStatus;
  field_summary: string;
  reported_by_name: string;
  created_at: string;
  updated_at: string;
};

export type AdminCatalogProductReportDetail = {
  id: string;
  pharmacy_id: string;
  product_id: string;
  status: CatalogProductReportStatus;
  product_snapshot: CatalogProductReportSnapshot;
  live_product: CatalogProductReportSnapshot;
  reported_field_keys: CatalogProductReportFieldKey[];
  fields: CatalogProductReportFieldInput[];
  events: CatalogProductReportEvent[];
  reported_by: string;
  created_at: string;
  updated_at: string;
};

export type PharmacistCatalogReportFilter = "active" | "awaiting_pharmacist" | "open" | "closed" | "cancelled" | "all";

export type AdminCatalogReportFilter = "open" | "awaiting_pharmacist" | "closed" | "cancelled" | "all";

export function catalogProductReportStatusLabelFr(status: CatalogProductReportStatus): string {
  switch (status) {
    case "open":
      return "En cours";
    case "awaiting_pharmacist":
      return "À valider";
    case "reopened":
      return "Retour envoyé";
    case "closed":
      return "Clôturé";
    case "cancelled":
      return "Annulé";
    default:
      return status;
  }
}

export function catalogProductReportEventLabelFr(eventType: string): string {
  switch (eventType) {
    case "submitted":
      return "Signalement envoyé";
    case "updated":
      return "Signalement modifié";
    case "cancelled":
      return "Signalement annulé";
    case "admin_saved":
      return "Produit enregistré (admin)";
    case "admin_resolved":
      return "Traité par Pharmeto";
    case "pharmacist_accepted":
      return "Validé par le pharmacien";
    case "pharmacist_rejected":
      return "Refus pharmacien";
    default:
      return eventType;
  }
}

export function isActiveCatalogProductReportStatus(status: CatalogProductReportStatus): boolean {
  return status === "open" || status === "awaiting_pharmacist" || status === "reopened";
}

export function snapshotValueToDisplay(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "number") return String(value);
  return String(value);
}

export function buildReportFieldsFromSnapshot(
  snapshot: CatalogProductReportSnapshot,
  keys: readonly CatalogProductReportFieldKey[]
): { key: CatalogProductReportFieldKey; currentValue: string | null }[] {
  return keys
    .map((key) => ({
      key,
      currentValue: snapshotValueToDisplay(snapshot[key]),
    }))
    .filter((row) => row.currentValue != null);
}

export function activeReportBadgeLabelFr(status: CatalogProductReportStatus): string {
  return status === "awaiting_pharmacist" ? "À valider" : "Signalé";
}
