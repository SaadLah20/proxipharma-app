import { AUTH_SYNC_CODE_NO_ACCOUNT_FOR_PHONE } from "@/lib/auth-sync-codes";
import {
  findAuthUserIdForWhatsApp,
  linkPhoneToAuthUser,
  verifyAuthPasswordViaEmail,
} from "@/lib/auth-link-phone-server";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { createSupabaseServiceClient } from "@/lib/supabase-service";

/**
 * Avant connexion par téléphone : si le numéro est dans le profil mais pas sur Auth,
 * vérifie le mot de passe (via e-mail Auth) puis lie le téléphone.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return Response.json({ error: "Configuration serveur incomplète." }, { status: 500 });
  }

  let body: { phone?: string; password?: string };
  try {
    body = (await req.json()) as { phone?: string; password?: string };
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const e164 = normalizePhoneToE164(body.phone ?? "");
  const password = body.password ?? "";
  if (!e164 || password.length < 6) {
    return Response.json({ error: "Numéro ou mot de passe invalide." }, { status: 400 });
  }

  let admin;
  try {
    admin = createSupabaseServiceClient();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }

  const userId = await findAuthUserIdForWhatsApp(admin, e164);
  if (!userId) {
    return Response.json(
      { error: "Aucun compte pour ce numéro.", code: AUTH_SYNC_CODE_NO_ACCOUNT_FOR_PHONE },
      { status: 404 },
    );
  }

  const { data: authData, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !authData.user) {
    return Response.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const authPhone = authData.user.phone ? normalizePhoneToE164(authData.user.phone) : null;
  if (authPhone === e164) {
    return Response.json({ ok: true, linked: false });
  }

  const email = authData.user.email?.trim().toLowerCase();
  if (!email || email.endsWith("@anonymous.invalid")) {
    return Response.json(
      {
        error:
          "Ce compte ne permet pas la connexion par téléphone. Utilisez l’e-mail ou contactez le support.",
      },
      { status: 400 }
    );
  }

  const passwordOk = await verifyAuthPasswordViaEmail(url, anonKey, email, password);
  if (!passwordOk) {
    return Response.json({ error: "Identifiant ou mot de passe incorrect." }, { status: 401 });
  }

  const linkResult = await linkPhoneToAuthUser(admin, userId, e164);
  if (!linkResult.ok) {
    const status = linkResult.code === "phone_taken" ? 409 : 400;
    return Response.json({ error: linkResult.error, code: linkResult.code }, { status });
  }

  return Response.json({ ok: true, linked: linkResult.linked });
}
