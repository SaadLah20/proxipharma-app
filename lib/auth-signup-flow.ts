import type { User } from "@supabase/supabase-js";

/** Métadonnée Auth : inscription OTP OK mais mot de passe pas encore défini. */
export const SIGNUP_META_PASSWORD_PENDING = "signup_password_pending";

export function userNeedsSignupPassword(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.user_metadata?.[SIGNUP_META_PASSWORD_PENDING] === true;
}

export function signupProfileFromUser(user: User): {
  full_name: string;
  whatsapp: string;
  email: string;
} {
  const meta = user.user_metadata ?? {};
  const whatsapp =
    (typeof meta.whatsapp === "string" && meta.whatsapp) ||
    (typeof meta.signup_phone === "string" && meta.signup_phone) ||
    user.phone ||
    "";
  return {
    full_name: typeof meta.full_name === "string" ? meta.full_name : "",
    whatsapp,
    email: user.email?.trim() ?? "",
  };
}

export function signupOtpChannelFromUser(user: User): "phone" | "email" {
  if (user.email && user.email_confirmed_at) return "email";
  if (user.phone) return "phone";
  return "email";
}
