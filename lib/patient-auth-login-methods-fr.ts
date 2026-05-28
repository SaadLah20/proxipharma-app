import type { User } from "@supabase/supabase-js";
import { normalizePhoneToE164 } from "@/lib/phone-e164";

export type PatientLoginMethods = {
  canLoginWithEmail: boolean;
  canLoginWithPhone: boolean;
  authEmail: string | null;
  authPhoneE164: string | null;
  profileWhatsapp: string | null;
  needsPhoneAuthSync: boolean;
};

export function patientLoginMethodsFromAuthAndProfile(
  user: User | null | undefined,
  profileWhatsapp: string | null | undefined
): PatientLoginMethods {
  const authEmail = user?.email?.trim() || null;
  const authPhoneRaw = user?.phone?.trim() || null;
  const authPhoneE164 = authPhoneRaw ? normalizePhoneToE164(authPhoneRaw) : null;
  const profilePhone = profileWhatsapp?.trim()
    ? normalizePhoneToE164(profileWhatsapp) ?? profileWhatsapp.trim()
    : null;

  const canLoginWithEmail = Boolean(authEmail && !authEmail.endsWith("@anonymous.invalid"));
  const canLoginWithPhone = Boolean(authPhoneE164);
  const needsPhoneAuthSync = Boolean(profilePhone && !canLoginWithPhone);

  return {
    canLoginWithEmail,
    canLoginWithPhone,
    authEmail,
    authPhoneE164,
    profileWhatsapp: profilePhone,
    needsPhoneAuthSync,
  };
}

export function patientLoginMethodsSummaryFr(m: PatientLoginMethods): string {
  if (m.canLoginWithEmail && m.canLoginWithPhone) {
    return "Connexion avec votre e-mail ou votre numéro de téléphone, et votre mot de passe.";
  }
  if (m.canLoginWithEmail) {
    return "Connexion avec votre e-mail et votre mot de passe.";
  }
  if (m.canLoginWithPhone) {
    return "Connexion avec votre numéro de téléphone et votre mot de passe.";
  }
  return "Identifiant de connexion incomplet — contactez le support.";
}

export function patientLoginIdentifiersListFr(m: PatientLoginMethods): string[] {
  const lines: string[] = [];
  if (m.canLoginWithPhone && m.authPhoneE164) {
    lines.push(`Téléphone : ${m.authPhoneE164}`);
  } else if (m.profileWhatsapp && m.needsPhoneAuthSync) {
    lines.push(`Téléphone (profil) : ${m.profileWhatsapp} — liaison connexion à finaliser ci-dessous`);
  }
  if (m.canLoginWithEmail && m.authEmail) {
    lines.push(`E-mail : ${m.authEmail}`);
  }
  return lines;
}
