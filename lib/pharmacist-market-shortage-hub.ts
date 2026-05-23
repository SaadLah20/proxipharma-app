import { resolvePublicMediaUrl } from "@/lib/storage-media";
import { formatDateShortFr, formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { requestTypeFr } from "@/lib/request-display";

export type MarketShortageHubLine = {
  market_shortage_id: string;
  product_id: string;
  product_name: string;
  product_photo_url: string | null;
  shortage_since: string;
  request_item_id: string | null;
  request_id: string | null;
  request_public_ref: string;
  request_type: string;
  request_status: string;
  responded_at: string | null;
  patient_id: string | null;
  patient_display_name: string;
  patient_ref: string;
};

export type MarketShortageProductGroup = {
  marketShortageId: string;
  productId: string;
  productName: string;
  photoUrl: string | null;
  shortageSince: string;
  lines: MarketShortageHubLine[];
  requestCount: number;
  patientCount: number;
  notifyablePatientCount: number;
};

export function normalizeMarketShortageHubLine(raw: Record<string, unknown>): MarketShortageHubLine {
  return {
    market_shortage_id: String(raw.market_shortage_id),
    product_id: String(raw.product_id),
    product_name: String(raw.product_name ?? "Produit"),
    product_photo_url: resolvePublicMediaUrl(
      typeof raw.product_photo_url === "string" ? raw.product_photo_url : null
    ),
    shortage_since: String(raw.shortage_since),
    request_item_id: raw.request_item_id != null ? String(raw.request_item_id) : null,
    request_id: raw.request_id != null ? String(raw.request_id) : null,
    request_public_ref: String(raw.request_public_ref ?? ""),
    request_type: String(raw.request_type ?? ""),
    request_status: String(raw.request_status ?? ""),
    responded_at: raw.responded_at != null ? String(raw.responded_at) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    patient_display_name: String(raw.patient_display_name ?? "").trim(),
    patient_ref: String(raw.patient_ref ?? "").trim(),
  };
}

export function groupMarketShortageLines(lines: MarketShortageHubLine[]): MarketShortageProductGroup[] {
  const map = new Map<string, MarketShortageHubLine[]>();

  for (const line of lines) {
    const list = map.get(line.product_id) ?? [];
    list.push(line);
    map.set(line.product_id, list);
  }

  const groups: MarketShortageProductGroup[] = [];

  for (const [productId, groupLines] of map) {
    const base = groupLines[0];
    const detailLines = groupLines.filter((l) => l.request_id && l.request_item_id);
    const patientIds = new Set(detailLines.map((l) => l.patient_id).filter(Boolean));
    const requestIds = new Set(detailLines.map((l) => l.request_id).filter(Boolean));

    groups.push({
      marketShortageId: base.market_shortage_id,
      productId,
      productName: base.product_name,
      photoUrl: base.product_photo_url,
      shortageSince: base.shortage_since,
      lines: detailLines.sort((a, b) => {
        const ta = a.responded_at ?? "";
        const tb = b.responded_at ?? "";
        return tb.localeCompare(ta);
      }),
      requestCount: requestIds.size,
      patientCount: patientIds.size,
      notifyablePatientCount: patientIds.size,
    });
  }

  groups.sort((a, b) => {
    const cmp = b.shortageSince.localeCompare(a.shortageSince);
    if (cmp !== 0) return cmp;
    return a.productName.localeCompare(b.productName, "fr");
  });

  return groups;
}

export function formatShortageLinePatient(line: MarketShortageHubLine): string {
  const name = line.patient_display_name || "Patient";
  const ref = line.patient_ref.trim();
  return ref ? `${name} · ${ref}` : name;
}

export function formatShortageLineRequest(line: MarketShortageHubLine): string {
  const ref = line.request_public_ref.trim() || "—";
  const type = requestTypeFr[line.request_type] ?? line.request_type;
  const when = line.responded_at ? formatDateShortFr(line.responded_at) : "—";
  return `${ref} · ${type} · répondu le ${when}`;
}

export function formatShortageSince(iso: string): string {
  return formatDateTimeShort24hFr(iso);
}
