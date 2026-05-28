import { createClient } from "@supabase/supabase-js";
import { linkPhoneToAuthUser } from "@/lib/auth-link-phone-server";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

/** Patient connecté : lie `profiles.whatsapp` à Auth pour activer la connexion par téléphone. */
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

  const { data: profile, error: pe } = await admin
    .from("profiles")
    .select("role,whatsapp")
    .eq("id", user.id)
    .maybeSingle();

  if (pe) {
    return Response.json({ error: pe.message }, { status: 500 });
  }
  if ((profile as { role?: string } | null)?.role !== "patient") {
    return Response.json({ error: "Action réservée aux comptes patient." }, { status: 403 });
  }

  const whatsapp = (profile as { whatsapp?: string | null } | null)?.whatsapp?.trim();
  if (!whatsapp) {
    return Response.json({ error: "Aucun numéro sur votre profil." }, { status: 400 });
  }

  const e164 = normalizePhoneToE164(whatsapp);
  if (!e164) {
    return Response.json({ error: "Numéro du profil invalide." }, { status: 400 });
  }

  const result = await linkPhoneToAuthUser(admin, user.id, e164);
  if (!result.ok) {
    const status = result.code === "phone_taken" ? 409 : 400;
    return Response.json({ error: result.error, code: result.code }, { status });
  }

  return Response.json({ ok: true, linked: result.linked, phone: e164 });
}
