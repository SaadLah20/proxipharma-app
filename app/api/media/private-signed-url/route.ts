import { createClient } from "@supabase/supabase-js";
import { STORAGE_BUCKET_PRIVATE } from "@/lib/storage-media";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

/** URL signée lecture private-media (service role) après vérif. RLS via JWT utilisateur. */
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Configuration Supabase manquante." }, { status: 500 });
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
  const m = objectPath.match(/^ordonnances\/([0-9a-f-]{36})\/[^/]+$/i);
  if (!m) {
    return Response.json({ error: "Chemin média invalide." }, { status: 400 });
  }
  const requestId = m[1];

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: reqRow, error: reqErr } = await userClient
    .from("requests")
    .select("id")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr) {
    return Response.json({ error: reqErr.message }, { status: 500 });
  }
  if (!reqRow) {
    return Response.json({ error: "Accès refusé à ce fichier." }, { status: 403 });
  }

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const folder = `ordonnances/${requestId}`;
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
