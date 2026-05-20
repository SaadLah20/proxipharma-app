import { fetchPrivateMediaSignedUrl } from "@/lib/private-media-signed-url-client";
import { supabase } from "@/lib/supabase";
import { STORAGE_BUCKET_PRIVATE, consultationMediaObjectPath } from "@/lib/storage-media";

export type ConsultationImagePaths = {
  photo1: string | null;
  photo2: string | null;
  photo3: string | null;
};

export const CONSULTATION_MAX_PHOTOS = 3;

export function consultationSlotStoragePaths(requestId: string): Record<1 | 2 | 3, string> {
  return {
    1: consultationMediaObjectPath(requestId, 1),
    2: consultationMediaObjectPath(requestId, 2),
    3: consultationMediaObjectPath(requestId, 3),
  };
}

export async function createConsultationSignedUrl(
  objectPath: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const viaApi = await fetchPrivateMediaSignedUrl(objectPath);
  if (viaApi.url) return viaApi;

  const path = objectPath.replace(/^\//, "");
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_PRIVATE)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return { url: null, error: viaApi.error ?? error.message };
  return { url: data.signedUrl ?? null, error: null };
}

export async function uploadConsultationPhotoBlob(
  requestId: string,
  slot: 1 | 2 | 3,
  blob: Blob
): Promise<{ path: string; error: string | null }> {
  const objectPath = consultationMediaObjectPath(requestId, slot);
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
        ? " Appliquez la migration 20260529_001_free_consultation_workflow.sql sur Supabase."
        : "";
    return { path: objectPath, error: `${error.message}${hint}` };
  }
  return { path: objectPath, error: null };
}

export async function compressImageFileForConsultation(file: File): Promise<Blob> {
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
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Échec compression image."))),
      "image/webp",
      0.85
    );
  });
}

export function pathsToAttachPayload(paths: ConsultationImagePaths): {
  p_image_1_path: string | null;
  p_image_2_path: string | null;
  p_image_3_path: string | null;
} {
  return {
    p_image_1_path: paths.photo1,
    p_image_2_path: paths.photo2,
    p_image_3_path: paths.photo3,
  };
}
