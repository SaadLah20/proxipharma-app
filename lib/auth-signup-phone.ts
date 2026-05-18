import { normalizePhoneToE164 } from "@/lib/phone-e164";

const SIGNUP_NEW_USER_MAX_AGE_MS = 20 * 60 * 1000;

export async function checkPhoneAvailableForSignup(
  phoneInput: string
): Promise<{ available: boolean; e164: string | null; error?: string }> {
  const e164 = normalizePhoneToE164(phoneInput);
  if (!e164) {
    return { available: false, e164: null, error: "invalid_phone" };
  }

  const res = await fetch("/api/auth/signup-phone-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: e164 }),
  });

  const json = (await res.json()) as { available?: boolean; e164?: string; error?: string };
  if (!res.ok) {
    return { available: false, e164, error: json.error ?? "check_failed" };
  }

  return { available: json.available === true, e164: json.e164 ?? e164 };
}

/** Compte créé il y a peu (inscription en cours) vs numéro déjà enregistré. */
export function authUserLooksLikeFreshSignup(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  const t = new Date(createdAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= SIGNUP_NEW_USER_MAX_AGE_MS;
}

export const SIGNUP_PHONE_ALREADY_REGISTERED_FR =
  "Ce numéro est déjà associé à un compte. Utilisez Connexion avec votre mot de passe.";

/** E-mail assez valide pour l’OTP inscription (contourne SMS Inwi si renseigné). */
export function normalizeSignupEmail(raw: string): string | null {
  const e = raw.trim().toLowerCase();
  if (!e.includes("@") || !e.includes(".")) return null;
  return e;
}
