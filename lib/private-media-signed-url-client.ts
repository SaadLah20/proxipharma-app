import { getBearerAccessTokenForApi } from "@/lib/supabase-access-token";

/** URL signée lecture private-media via API (patient + pharmacien de l’officine). */
export async function fetchPrivateMediaSignedUrl(
  objectPath: string
): Promise<{ url: string | null; error: string | null }> {
  const path = objectPath.replace(/^\//, "").trim();
  if (!path) return { url: null, error: "Chemin média manquant." };

  const { token, error: tokenErr } = await getBearerAccessTokenForApi();
  if (!token) return { url: null, error: tokenErr ?? "Session expirée." };

  const res = await fetch("/api/media/private-signed-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ path }),
  });

  let body: { url?: string; error?: string } = {};
  try {
    body = (await res.json()) as { url?: string; error?: string };
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    return { url: null, error: body.error ?? `Impossible de charger l’image (${res.status}).` };
  }

  return { url: body.url ?? null, error: body.url ? null : "URL signée vide." };
}
