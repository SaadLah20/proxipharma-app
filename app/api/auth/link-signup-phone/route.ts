import { createClient } from "@supabase/supabase-js";
import { linkPhoneToAuthUser } from "@/lib/auth-link-phone-server";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Lie le téléphone obligatoire à Auth après inscription par e-mail (session patient requise). */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return Response.json({ error: "Session requise." }, { status: 401 });
  }

  let body: { phone?: string };
  try {
    body = (await req.json()) as { phone?: string };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const e164 = normalizePhoneToE164(body.phone ?? "");
  if (!e164) {
    return Response.json({ error: "Numéro invalide.", code: "invalid_phone" }, { status: 400 });
  }

  const authClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser(token);

  if (userErr || !user) {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const result = await linkPhoneToAuthUser(admin, user.id, e164);
  if (!result.ok) {
    const status = result.code === "phone_taken" ? 409 : 400;
    return Response.json({ error: result.error, code: result.code }, { status });
  }

  await admin.from("profiles").update({ whatsapp: e164 }).eq("id", user.id);

  return Response.json({ ok: true, linked: result.linked });
}
