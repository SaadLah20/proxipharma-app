import { getBearerAccessTokenForApi } from "@/lib/supabase-access-token";
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
  _expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const path = objectPath.replace(/^\//, "");

  const { token, error: tokenErr } = await getBearerAccessTokenForApi();
  if (!token) {
    return { url: null, error: tokenErr };
  }

  let res: Response;
  try {
    res = await fetch("/api/media/private-signed-url", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path }),
    });
  } catch (e) {
    return { url: null, error: e instanceof Error ? e.message : "Réseau indisponible." };
  }

  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok) {
    return { url: null, error: body.error ?? `Lecture image refusée (${res.status}).` };
  }
  return { url: body.url ?? null, error: null };
}

export async function uploadPrescriptionPageBlob(
  requestId: string,
  page: 1 | 2,
  blob: Blob
): Promise<{ path: string; error: string | null }> {
  const paths = prescriptionPageStoragePaths(requestId);
  const objectPath = page === 1 ? paths.page1 : paths.page2;

  const { token, error: tokenErr } = await getBearerAccessTokenForApi();
  if (!token) {
    return { path: objectPath, error: tokenErr ?? "Session expirée. Reconnecte-toi." };
  }

  const form = new FormData();
  form.append("request_id", requestId);
  form.append("page", String(page));
  form.append(
    "file",
    blob instanceof File ? blob : new File([blob], `page${page}.webp`, { type: "image/webp" })
  );

  let res: Response;
  try {
    res = await fetch("/api/patient/prescription-page", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (e) {
    return { path: objectPath, error: e instanceof Error ? e.message : "Réseau indisponible." };
  }

  const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!res.ok) {
    return { path: objectPath, error: body.error ?? `Upload refusé (${res.status}).` };
  }
  return { path: body.path ?? objectPath, error: null };
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
