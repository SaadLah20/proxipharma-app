import { normalizePhoneToE164 } from "@/lib/phone-e164";

export type LoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; phone: string };

/** Interprète le champ unique connexion (e-mail ou numéro). */
export function parseLoginIdentifier(raw: string): LoginIdentifier | null {
  const t = raw.trim();
  if (!t) return null;
  if (t.includes("@")) {
    const email = t.toLowerCase();
    return email.includes(".") ? { kind: "email", email } : null;
  }
  const phone = normalizePhoneToE164(t);
  return phone ? { kind: "phone", phone } : null;
}
