export const runtime = "nodejs";

import { STORAGE_BUCKET_PRIVATE } from "@/lib/storage-media";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { verifyBearerUser } from "@/lib/verify-bearer-user";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

async function userMayAccessRequest(
  admin: ReturnType<typeof createSupabaseServiceClient>,
  userId: string,
  requestId: string
): Promise<boolean> {
  const { data: reqRow, error } = await admin
    .from("requests")
    .select("id,patient_id,pharmacy_id")
    .eq("id", requestId)
    .maybeSingle();
  if (error || !reqRow) return false;
  if (reqRow.patient_id === userId) return true;
  const { data: staff } = await admin
    .from("pharmacy_staff")
    .select("user_id")
    .eq("pharmacy_id", reqRow.pharmacy_id)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(staff?.user_id);
}

/** URL signée lecture private-media (service role) après vérif. accès demande. */
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { user, error: authErr } = await verifyBearerUser(token);
  if (authErr || !user) {
    return Response.json({ error: authErr ?? "Session invalide." }, { status: 401 });
  }

  let body: { path?: string };
  try {
    body = (await req.json()) as { path?: string };
  } catch {
    return Response.json({ error: "Corps invalide." }, { status: 400 });
  }

  const objectPath = String(body.path ?? "")
    .trim()
    .replace(/^\//, "");
  const m = objectPath.match(/^(ordonnances|consultations)\/([0-9a-f-]{36})\/[^/]+$/i);
  if (!m) {
    return Response.json({ error: "Chemin média invalide." }, { status: 400 });
  }
  const requestId = m[2];
  const folderPrefix = m[1].toLowerCase();

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const allowed = await userMayAccessRequest(admin, user.id, requestId);
  if (!allowed) {
    return Response.json({ error: "Accès refusé à ce fichier." }, { status: 403 });
  }

  const folder = `${folderPrefix}/${requestId}`;
  const fileName = objectPath.slice(folder.length + 1);
  const { data: listing, error: listErr } = await admin.storage.from(STORAGE_BUCKET_PRIVATE).list(folder, {
    limit: 10,
    search: fileName,
  });
  if (listErr) {
    return Response.json({ error: listErr.message }, { status: 500 });
  }
  const found = (listing ?? []).some((o) => o.name === fileName);
  if (!found) {
    return Response.json(
      { error: "Fichier introuvable sur le serveur (envoi photo peut-être incomplet)." },
      { status: 404 }
    );
  }

  const { data, error: signErr } = await admin.storage
    .from(STORAGE_BUCKET_PRIVATE)
    .createSignedUrl(objectPath, 3600);

  if (signErr || !data?.signedUrl) {
    return Response.json({ error: signErr?.message ?? "URL signée impossible." }, { status: 500 });
  }

  return Response.json({ url: data.signedUrl });
}
