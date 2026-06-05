import type { useTranslations } from "next-intl";

type AuthT = ReturnType<typeof useTranslations<"auth">>;

/** Mappe les erreurs Supabase Auth courantes vers des messages localisés. */
export function mapAuthErrorToLocale(message: string, t: AuthT): string {
  const m = message.trim().toLowerCase();
  if (!m) return message;
  if (m.includes("email rate") || m.includes("over_email_send_rate")) {
    return t("errors.emailRateLimit");
  }
  if (m.includes("sms rate") || m.includes("over_sms_send_rate")) {
    return t("errors.smsRateLimit");
  }
  if (m.includes("token has expired") || m.includes("otp_expired")) {
    return t("errors.otpExpired");
  }
  if (m.includes("invalid otp") || m.includes("token is invalid")) {
    return t("errors.otpInvalid");
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return t("errors.alreadyRegistered");
  }
  if (m.includes("invalid login credentials")) {
    return t("errors.invalidCredentials");
  }
  return message;
}

/** @deprecated Utiliser mapAuthErrorToLocale avec next-intl */
export { mapAuthErrorToFrench } from "@/lib/auth-messages-fr";
