import { ordonnanceMediaObjectPath, STORAGE_BUCKET_PRIVATE } from "@/lib/storage-media";
import { createSupabaseServiceClient } from "@/lib/supabase-service";
import { verifyBearerUser } from "@/lib/verify-bearer-user";

const MAX_BYTES = 8 * 1024 * 1024;

function bearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return null;
  const t = h.slice(7).trim();
  return t.length > 0 ? t : null;
}

/** Upload page ordonnance côté serveur (service role) après vérif. propriété patient. */
export async function POST(req: Request) {
  const token = bearerToken(req);
  if (!token) {
    return Response.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { user, error: authErr } = await verifyBearerUser(token);
  if (authErr || !user) {
    return Response.json({ error: authErr ?? "Session invalide." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const requestId = String(form.get("request_id") ?? "").trim();
  const pageRaw = String(form.get("page") ?? "").trim();
  const file = form.get("file");

  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return Response.json({ error: "request_id invalide." }, { status: 400 });
  }
  if (pageRaw !== "1" && pageRaw !== "2") {
    return Response.json({ error: "page doit être 1 ou 2." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "Fichier image manquant." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Image trop volumineuse (max 8 Mo)." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return Response.json({ error: "Format non supporté." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const { data: reqRow, error: reqErr } = await admin
    .from("requests")
    .select("id,patient_id,request_type,status")
    .eq("id", requestId)
    .maybeSingle();

  if (reqErr) {
    return Response.json({ error: reqErr.message }, { status: 500 });
  }
  if (!reqRow || reqRow.patient_id !== user.id) {
    return Response.json({ error: "Demande introuvable." }, { status: 403 });
  }
  if (reqRow.request_type !== "prescription") {
    return Response.json({ error: "Type de demande incorrect." }, { status: 400 });
  }
  if (!["draft", "submitted", "in_review"].includes(reqRow.status)) {
    return Response.json({ error: "Cette demande n’accepte plus de photos." }, { status: 400 });
  }

  const page = pageRaw === "2" ? 2 : 1;
  const objectPath = ordonnanceMediaObjectPath(requestId, page === 1 ? "page1" : "page2", "webp");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const contentType = file.type === "image/webp" ? "image/webp" : file.type || "image/webp";
  const { error: upErr } = await admin.storage.from(STORAGE_BUCKET_PRIVATE).upload(objectPath, bytes, {
    upsert: true,
    contentType,
  });

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 });
  }

  return Response.json({ path: objectPath });
}
