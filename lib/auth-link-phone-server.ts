import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhoneToE164 } from "@/lib/phone-e164";

export type LinkAuthPhoneResult =
  | { ok: true; linked: boolean }
  | { ok: false; error: string; code: "invalid_phone" | "phone_taken" | "user_not_found" | "update_failed" };

function phonesMatch(a: string | null | undefined, b: string): boolean {
  const na = a ? normalizePhoneToE164(a) : null;
  const nb = normalizePhoneToE164(b);
  return Boolean(na && nb && na === nb);
}

/** Utilisateur Auth associé à ce numéro (via `profiles.whatsapp`). */
export async function findAuthUserIdForWhatsApp(
  admin: SupabaseClient,
  e164: string
): Promise<string | null> {
  const phone = normalizePhoneToE164(e164);
  if (!phone) return null;

  const { data: byProfile, error: pe } = await admin
    .from("profiles")
    .select("id")
    .eq("whatsapp", phone)
    .limit(2);

  if (pe) return null;
  if (byProfile?.length === 1) return byProfile[0]!.id as string;

  return null;
}

/**
 * Attache un téléphone E.164 à `auth.users` (confirmé) — inscription e-mail ou rattrapage comptes legacy.
 */
export async function linkPhoneToAuthUser(
  admin: SupabaseClient,
  userId: string,
  e164: string
): Promise<LinkAuthPhoneResult> {
  const phone = normalizePhoneToE164(e164);
  if (!phone) {
    return { ok: false, error: "Numéro invalide.", code: "invalid_phone" };
  }

  const { data: authData, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !authData.user) {
    return { ok: false, error: "Compte introuvable.", code: "user_not_found" };
  }

  if (phonesMatch(authData.user.phone, phone)) {
    return { ok: true, linked: false };
  }

  const { data: phoneTaken, error: rpcErr } = await admin.rpc("auth_phone_user_exists", {
    p_phone: phone,
  });
  if (rpcErr) {
    return { ok: false, error: rpcErr.message, code: "update_failed" };
  }

  if (phoneTaken === true) {
    const ownerId = await findAuthUserIdForWhatsApp(admin, phone);
    if (ownerId && ownerId !== userId) {
      return {
        ok: false,
        error: "Ce numéro est déjà utilisé par un autre compte.",
        code: "phone_taken",
      };
    }
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
    phone,
    phone_confirm: true,
  });

  if (updateErr) {
    const msg = updateErr.message.toLowerCase();
    if (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists")) {
      return {
        ok: false,
        error: "Ce numéro est déjà utilisé par un autre compte.",
        code: "phone_taken",
      };
    }
    return { ok: false, error: updateErr.message, code: "update_failed" };
  }

  return { ok: true, linked: true };
}

/** Vérifie le mot de passe via l’e-mail Auth (sans conserver de session). */
export async function verifyAuthPasswordViaEmail(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<boolean> {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) return false;
  await client.auth.signOut();
  return true;
}
