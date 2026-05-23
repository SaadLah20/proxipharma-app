import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { formatDateShortFr } from "@/lib/datetime-fr";
import { requestTypeFr } from "@/lib/request-display";

/** Ligne brute renvoyée par `pharmacist_ordered_supply_hub_lines`. */
export type OrderedSupplyHubLine = {
  request_item_id: string;
  request_id: string;
  request_public_ref: string;
  request_type: string;
  request_status: string;
  catalog_product_id: string;
  product_name: string;
  product_photo_url: string | null;
  selected_qty: number;
  expected_availability_date: string | null;
  post_confirm_fulfillment: "unset" | "reserved" | "ordered" | "arrived_reserved";
  fulfillment_bucket: "pending" | "received";
  patient_id: string;
  patient_display_name: string;
  patient_ref: string;
  counter_outcome: string;
  line_updated_at: string;
};

export type OrderedSupplyHubTab = "pending" | "received";

export type OrderedSupplyProductGroup = {
  catalogProductId: string;
  productName: string;
  photoUrl: string | null;
  lines: OrderedSupplyHubLine[];
  totalQty: number;
  requestCount: number;
  patientCount: number;
  pendingQty: number;
  receivedQty: number;
  hasUnset: boolean;
  hasOrdered: boolean;
  earliestEta: string | null;
};

export function normalizeOrderedSupplyHubLine(raw: Record<string, unknown>): OrderedSupplyHubLine {
  return {
    request_item_id: String(raw.request_item_id),
    request_id: String(raw.request_id),
    request_public_ref: String(raw.request_public_ref ?? ""),
    request_type: String(raw.request_type),
    request_status: String(raw.request_status),
    catalog_product_id: String(raw.catalog_product_id),
    product_name: String(raw.product_name ?? "Produit"),
    product_photo_url: resolvePublicMediaUrl(
      typeof raw.product_photo_url === "string" ? raw.product_photo_url : null
    ),
    selected_qty: Number(raw.selected_qty) || 1,
    expected_availability_date:
      typeof raw.expected_availability_date === "string" ? raw.expected_availability_date : null,
    post_confirm_fulfillment: (raw.post_confirm_fulfillment ??
      "unset") as OrderedSupplyHubLine["post_confirm_fulfillment"],
    fulfillment_bucket: raw.fulfillment_bucket === "received" ? "received" : "pending",
    patient_id: String(raw.patient_id),
    patient_display_name: String(raw.patient_display_name ?? "").trim(),
    patient_ref: String(raw.patient_ref ?? "").trim(),
    counter_outcome: String(raw.counter_outcome ?? "unset"),
    line_updated_at: String(raw.line_updated_at),
  };
}

export function lineFulfillmentLabelFr(line: OrderedSupplyHubLine): string {
  if (line.post_confirm_fulfillment === "arrived_reserved") return "Reçu en officine";
  if (line.post_confirm_fulfillment === "ordered") return "Commandé";
  return "À commander";
}

export function groupOrderedSupplyLinesByProduct(
  lines: OrderedSupplyHubLine[],
  tab: OrderedSupplyHubTab
): OrderedSupplyProductGroup[] {
  const bucket = tab === "pending" ? "pending" : "received";
  const filtered = lines.filter((l) => l.fulfillment_bucket === bucket);
  const map = new Map<string, OrderedSupplyHubLine[]>();

  for (const line of filtered) {
    const list = map.get(line.catalog_product_id) ?? [];
    list.push(line);
    map.set(line.catalog_product_id, list);
  }

  const groups: OrderedSupplyProductGroup[] = [];
  for (const [catalogProductId, groupLines] of map) {
    const sorted = [...groupLines].sort((a, b) => {
      const ea = a.expected_availability_date ?? "9999-12-31";
      const eb = b.expected_availability_date ?? "9999-12-31";
      if (ea !== eb) return ea.localeCompare(eb);
      return a.product_name.localeCompare(b.product_name, "fr");
    });
    const patientIds = new Set(sorted.map((l) => l.patient_id));
    const requestIds = new Set(sorted.map((l) => l.request_id));
    const pendingLines = sorted.filter((l) => l.fulfillment_bucket === "pending");
    const receivedLines = sorted.filter((l) => l.fulfillment_bucket === "received");
    const etas = sorted
      .map((l) => l.expected_availability_date)
      .filter((d): d is string => Boolean(d))
      .sort();

    groups.push({
      catalogProductId,
      productName: sorted[0]?.product_name ?? "Produit",
      photoUrl: sorted[0]?.product_photo_url ?? null,
      lines: sorted,
      totalQty: sorted.reduce((s, l) => s + l.selected_qty, 0),
      requestCount: requestIds.size,
      patientCount: patientIds.size,
      pendingQty: pendingLines.reduce((s, l) => s + l.selected_qty, 0),
      receivedQty: receivedLines.reduce((s, l) => s + l.selected_qty, 0),
      hasUnset: sorted.some((l) => l.post_confirm_fulfillment === "unset"),
      hasOrdered: sorted.some((l) => l.post_confirm_fulfillment === "ordered"),
      earliestEta: etas[0] ?? null,
    });
  }

  groups.sort((a, b) => {
    if (tab === "pending") {
      const ea = a.earliestEta ?? "9999-12-31";
      const eb = b.earliestEta ?? "9999-12-31";
      if (ea !== eb) return ea.localeCompare(eb);
    }
    return a.productName.localeCompare(b.productName, "fr");
  });

  return groups;
}

export function formatLinePatientLabel(line: OrderedSupplyHubLine): string {
  const name = line.patient_display_name || "Patient";
  const ref = line.patient_ref.trim();
  return ref ? `${name} · ${ref}` : name;
}

export function formatLineRequestMeta(line: OrderedSupplyHubLine): string {
  const ref = line.request_public_ref.trim() || "—";
  const type = requestTypeFr[line.request_type] ?? line.request_type;
  const eta = line.expected_availability_date
    ? ` · prévu ${formatDateShortFr(line.expected_availability_date)}`
    : "";
  return `${ref} · ${type}${eta}`;
}

/** Somme des qtés des lignes cochées ; erreur si dépasse la qté reçue. */
export function validatePartialArrivalSelection(
  lines: OrderedSupplyHubLine[],
  selectedIds: Set<string>,
  receivedQty: number
): string | null {
  if (selectedIds.size === 0) return "Sélectionnez au moins une demande.";
  let sum = 0;
  for (const line of lines) {
    if (!selectedIds.has(line.request_item_id)) continue;
    sum += line.selected_qty;
  }
  if (sum <= 0) return "Quantité invalide.";
  if (sum > receivedQty) {
    return `La quantité sélectionnée (${sum}) dépasse la quantité reçue (${receivedQty}).`;
  }
  return null;
}

export function pendingLinesForProduct(group: OrderedSupplyProductGroup): OrderedSupplyHubLine[] {
  return group.lines.filter((l) => l.fulfillment_bucket === "pending");
}

export function receivedLinesForProduct(group: OrderedSupplyProductGroup): OrderedSupplyHubLine[] {
  return group.lines.filter((l) => l.fulfillment_bucket === "received");
}

export function canRevertReceivedLine(line: OrderedSupplyHubLine): boolean {
  return line.fulfillment_bucket === "received" && line.counter_outcome === "unset";
}
