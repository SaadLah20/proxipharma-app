import { supabase } from "@/lib/supabase";
import {
  STORAGE_BUCKET_PUBLIC,
  pharmacyImageObjectPath,
  type PharmacyImageKind,
} from "@/lib/storage-media";

const MAX_BYTES = 8 * 1024 * 1024;

async function compressImageFile(file: File, maxSide: number): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("Compression indisponible côté serveur.");
  }
  const bitmap = await createImageBitmap(file);
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

/** Upload logo ou couverture officine (bucket public-assets, WebP). */
export async function uploadPharmacyImageFile(
  pharmacyId: string,
  kind: PharmacyImageKind,
  file: File,
  previousPath?: string | null
): Promise<{ path: string; error: string | null }> {
  if (file.size > MAX_BYTES) {
    return { path: "", error: "Image trop lourde (max. 8 Mo)." };
  }
  if (!file.type.startsWith("image/")) {
    return { path: "", error: "Choisissez une image (JPEG, PNG, WebP…)." };
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return { path: "", error: "Session expirée. Reconnectez-vous." };
  }

  const maxSide = kind === "logo" ? 512 : 1920;
  let blob: Blob;
  try {
    blob = await compressImageFile(file, maxSide);
  } catch (e) {
    return { path: "", error: e instanceof Error ? e.message : "Compression impossible." };
  }

  const objectPath = pharmacyImageObjectPath(pharmacyId, kind, "webp");
  const { error } = await supabase.storage.from(STORAGE_BUCKET_PUBLIC).upload(objectPath, blob, {
    upsert: false,
    contentType: "image/webp",
  });

  if (error) {
    const rls =
      error.message.toLowerCase().includes("row-level security") ||
      error.message.toLowerCase().includes("policy");
    const hint = rls
      ? " Vérifiez que vous êtes bien rattaché à cette officine (pharmacy_staff) et que la migration Storage 20260524_001 est appliquée."
      : "";
    return { path: "", error: `${error.message}${hint}` };
  }

  const prev = previousPath?.trim();
  if (prev && prev !== objectPath) {
    await removePharmacyImageFile(prev);
  }

  return { path: objectPath, error: null };
}

export async function removePharmacyImageFile(objectPath: string): Promise<string | null> {
  const path = objectPath.replace(/^\//, "");
  const { error } = await supabase.storage.from(STORAGE_BUCKET_PUBLIC).remove([path]);
  return error?.message ?? null;
}
