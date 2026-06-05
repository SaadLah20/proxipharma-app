import { authFr } from "@/messages/fr/auth";

/** @deprecated Utiliser mapAuthErrorToLocale avec next-intl */
export function mapAuthErrorToFrench(message: string): string {
  const m = message.trim().toLowerCase();
  if (!m) return message;
  if (m.includes("email rate") || m.includes("over_email_send_rate")) {
    return authFr.errors.emailRateLimit;
  }
  if (m.includes("sms rate") || m.includes("over_sms_send_rate")) {
    return authFr.errors.smsRateLimit;
  }
  if (m.includes("token has expired") || m.includes("otp_expired")) {
    return authFr.errors.otpExpired;
  }
  if (m.includes("invalid otp") || m.includes("token is invalid")) {
    return authFr.errors.otpInvalid;
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return authFr.errors.alreadyRegistered;
  }
  if (m.includes("invalid login credentials")) {
    return authFr.errors.invalidCredentials;
  }
  return message;
}
