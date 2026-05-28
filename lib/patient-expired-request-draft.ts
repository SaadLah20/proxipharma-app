import type { PatientDemandeProduitsDraftLine } from "@/lib/patient-demande-produits-draft";
import { resolvePublicMediaUrl } from "@/lib/storage-media";

type ExpiredDraftItem = {
  product_id: string;
  requested_qty: number;
  client_comment?: string | null;
  line_source?: string | null;
  unit_price?: number | null;
  products:
    | { name: string; photo_url?: string | null }
    | { name: string; photo_url?: string | null }[]
    | null;
};

function oneProduct(
  embed: ExpiredDraftItem["products"]
): { name: string; photo_url?: string | null } | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

/** Lignes « demandées par vous » pour préremplir `/pharmacie/[id]/demande-produits` (expirée, annulée, etc.). */
export function buildPatientDemandeProduitsDraftFromArchiveRequest(
  items: ExpiredDraftItem[]
): PatientDemandeProduitsDraftLine[] {
  return items
    .filter((row) => row.line_source !== "pharmacist_proposed")
    .map((row) => {
      const prod = oneProduct(row.products);
      const unit =
        row.unit_price != null && Number.isFinite(Number(row.unit_price))
          ? Number(row.unit_price)
          : null;
      return {
        product_id: row.product_id,
        name: prod?.name?.trim() || "Produit",
        photo_url: resolvePublicMediaUrl(prod?.photo_url ?? null),
        qty: Math.max(1, Math.min(10, Math.floor(Number(row.requested_qty) || 1))),
        unit_price: unit,
        client_comment: row.client_comment?.trim() ?? "",
      };
    });
}

/** @deprecated Utiliser `buildPatientDemandeProduitsDraftFromArchiveRequest`. */
export const buildPatientDemandeProduitsDraftFromExpiredRequest =
  buildPatientDemandeProduitsDraftFromArchiveRequest;
