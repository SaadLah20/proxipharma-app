/**
 * Conventions stockage Pharmeto (Supabase Storage).
 * Buckets + chemins stables : même code en Free et en Pro.
 *
 * | Catégorie              | Bucket          | Préfixe chemin                    |
 * |------------------------|-----------------|-----------------------------------|
 * | Produits               | public-assets   | products/{id}/main.{ext}          |
 * | Pharmacies             | public-assets   | pharmacies/{id}/logo|cover-{ms}.{ext} |
 * | Ordonnances            | private-media   | ordonnances/{request_id}/…        |
 * | Consultations libres     | private-media   | consultations/{request_id}/…    |
 * | Photos patient (dossier)| private-media  | patient/{request_id}/…          |
 * | Vocaux conversation      | private-media  | conversation/{request_id}/…     |
 */

export const STORAGE_BUCKET_PUBLIC = "public-assets";
export const STORAGE_BUCKET_PRIVATE = "private-media";

export const STORAGE_PATH_PREFIX = {
  products: "products",
  pharmacies: "pharmacies",
  ordonnances: "ordonnances",
  consultations: "consultations",
  patient: "patient",
  conversation: "conversation",
} as const;

export type PharmacyImageKind = "logo" | "cover";

export function productImageObjectPath(productId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.products}/${productId}/main.${ext}`;
}

/** Nouveau fichier à chaque upload (évite le cache navigateur sur une URL fixe). */
export function pharmacyImageObjectPath(
  pharmacyId: string,
  kind: PharmacyImageKind,
  ext = "webp",
  versionMs: number = Date.now()
): string {
  return `${STORAGE_PATH_PREFIX.pharmacies}/${pharmacyId}/${kind}-${versionMs}.${ext}`;
}

export function ordonnanceMediaObjectPath(requestId: string, fileId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.ordonnances}/${requestId}/${fileId}.${ext}`;
}

/** Photos consultation libre (photo1 … photo3). */
export function consultationMediaObjectPath(requestId: string, slot: 1 | 2 | 3, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.consultations}/${requestId}/photo${slot}.${ext}`;
}

/** Photos patient liées à une demande (boutons, brûlures, etc.). */
export function patientRequestMediaObjectPath(requestId: string, fileId: string, ext = "webp"): string {
  return `${STORAGE_PATH_PREFIX.patient}/${requestId}/${fileId}.${ext}`;
}

/** Message vocal fil conversation (`request_comments.audio_path`). */
export function conversationAudioObjectPath(requestId: string, commentId: string, ext: "webm" | "mp4" | "m4a"): string {
  return `${STORAGE_PATH_PREFIX.conversation}/${requestId}/${commentId}.${ext}`;
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

type ProductPhotoEmbed = { photo_url?: string | null };

/** Produit embarqué (join `products`) avec URL photo catalogue résolue pour `<img src>`. */
export function withResolvedProductPhoto<T extends ProductPhotoEmbed>(
  product: T | null | undefined
): T | null {
  if (!product) return null;
  const photo_url = resolvePublicMediaUrl(product.photo_url);
  if (photo_url === (product.photo_url ?? null)) return product;
  return { ...product, photo_url };
}

type RequestItemPhotoRow = {
  products?: ProductPhotoEmbed | ProductPhotoEmbed[] | null;
  request_item_alternatives?:
    | Array<{ products?: ProductPhotoEmbed | ProductPhotoEmbed[] | null }>
    | null;
};

function oneProductEmbed(
  products: ProductPhotoEmbed | ProductPhotoEmbed[] | null | undefined
): ProductPhotoEmbed | null {
  if (products == null) return null;
  return Array.isArray(products) ? (products[0] ?? null) : products;
}

/** Ligne demande + alternatives : chemins Storage → URLs publiques. */
export function mapRequestItemRowPhotos<T>(item: T): T {
  const row = item as RequestItemPhotoRow;
  const p = oneProductEmbed(row.products);
  const mappedProducts = p ? withResolvedProductPhoto(p) : row.products;
  const alts = row.request_item_alternatives;
  const mappedAlts = Array.isArray(alts)
    ? alts.map((alt) => {
        const ap = oneProductEmbed(alt.products);
        if (!ap) return alt;
        return { ...alt, products: withResolvedProductPhoto(ap) };
      })
    : alts;
  return { ...row, products: mappedProducts ?? row.products, request_item_alternatives: mappedAlts } as T;
}

export function mapRequestItemsPhotos<T>(items: T[]): T[] {
  return items.map((item) => mapRequestItemRowPhotos(item));
}
