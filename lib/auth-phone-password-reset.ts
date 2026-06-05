import { normalizePhoneToE164 } from "@/lib/phone-e164";

/** Vérifie qu’un numéro est déjà enregistré (récupération mot de passe par SMS). */
export async function checkPhoneRegisteredForPasswordReset(
  phoneInput: string
): Promise<{ registered: boolean; e164: string | null; error?: string }> {
  const e164 = normalizePhoneToE164(phoneInput);
  if (!e164) {
    return { registered: false, e164: null, error: "invalid_phone" };
  }

  const res = await fetch("/api/auth/signup-phone-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: e164 }),
  });

  const json = (await res.json()) as { available?: boolean; e164?: string; error?: string };
  if (!res.ok) {
    return { registered: false, e164, error: json.error ?? "check_failed" };
  }

  return { registered: json.available === false, e164: json.e164 ?? e164 };
}
