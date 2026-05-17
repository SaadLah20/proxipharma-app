/**
 * Conventions stockage ProxiPharma (Supabase Storage).
 * Buckets + chemins stables : même code en Free et en Pro.
 *
 * | Catégorie              | Bucket          | Préfixe chemin                    |
 * |------------------------|-----------------|-----------------------------------|
 * | Produits               | public-assets   | products/{id}/main.{ext}          |
 * | Pharmacies             | public-assets   | pharmacies/{id}/logo|cover.{ext} |
 * | Ordonnances            | private-media   | ordonnances/{request_id}/…        |
 * | Photos patient (dossier)| private-media  | patient/{request_id}/…          |
 */

export const STORAGE_BUCKET_PUBLIC = "public-assets";
export const STORAGE_BUCKET_PRIVATE = "private-media";

export const STORAGE_PATH_PREFIX = {
  products: "products",
  pharmacies: "pharmacies",
  ordonnances: "ordonnances",
  patient: "patient",
} as const;

export type PharmacyImageKind = "logo" | "cover";

export function productImageObjectPath(productId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.products}/${productId}/main.${ext}`;
}

export function pharmacyImageObjectPath(
  pharmacyId: string,
  kind: PharmacyImageKind,
  ext = "webp"
): string {
  return `${STORAGE_PATH_PREFIX.pharmacies}/${pharmacyId}/${kind}.${ext}`;
}

export function ordonnanceMediaObjectPath(requestId: string, fileId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.ordonnances}/${requestId}/${fileId}.${ext}`;
}

/** Photos patient liées à une demande (boutons, brûlures, etc.). */
export function patientRequestMediaObjectPath(requestId: string, fileId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.patient}/${requestId}/${fileId}.${ext}`;
}

function supabaseProjectUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!url) throw new Error("Missing env var: NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

/** URL publique (bucket public-assets uniquement). */
export function publicStorageObjectUrl(objectPath: string): string {
  const path = objectPath.replace(/^\//, "");
  return `${supabaseProjectUrl()}/storage/v1/object/public/${STORAGE_BUCKET_PUBLIC}/${path}`;
}

/**
 * Affichage : URL absolue inchangée (legacy Unsplash), sinon chemin → URL public-assets.
 */
export function resolvePublicMediaUrl(stored: string | null | undefined): string | null {
  const t = stored?.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return publicStorageObjectUrl(t);
}
