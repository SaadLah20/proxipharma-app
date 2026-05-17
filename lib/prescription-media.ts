import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKET_PRIVATE, ordonnanceMediaObjectPath } from "@/lib/storage-media";

export type PrescriptionPagePaths = {
  page1: string | null;
  page2: string | null;
};

/** Chemins Storage page 1 / 2 pour une demande ordonnance. */
export function prescriptionPageStoragePaths(requestId: string): { page1: string; page2: string } {
  return {
    page1: ordonnanceMediaObjectPath(requestId, "page1", "webp"),
    page2: ordonnanceMediaObjectPath(requestId, "page2", "webp"),
  };
}

export async function createPrescriptionSignedUrl(
  objectPath: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const path = objectPath.replace(/^\//, "");
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_PRIVATE)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return { url: null, error: error.message };
  return { url: data.signedUrl ?? null, error: null };
}

export async function uploadPrescriptionPageBlob(
  requestId: string,
  page: 1 | 2,
  blob: Blob
): Promise<{ path: string; error: string | null }> {
  const paths = prescriptionPageStoragePaths(requestId);
  const objectPath = page === 1 ? paths.page1 : paths.page2;

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { path: objectPath, error: "Session expirée. Reconnectez-vous." };
  }

  const { error } = await supabase.storage.from(STORAGE_BUCKET_PRIVATE).upload(objectPath, blob, {
    upsert: true,
    contentType: "image/webp",
  });

  if (error) {
    const hint =
      error.message.toLowerCase().includes("row-level security") ||
      error.message.toLowerCase().includes("policy")
        ? " Appliquez la migration SQL 20260528_001_fix_storage_path_filename_check.sql sur Supabase."
        : "";
    return { path: objectPath, error: `${error.message}${hint}` };
  }

  return { path: objectPath, error: null };
}

/** Compresse une image fichier pour upload (max ~1600px, WebP). */
export async function compressImageFileForPrescription(file: File): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Compression indisponible côté serveur.");
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec compression image."))),
      "image/webp",
      0.85
    );
  });
  return blob;
}
