/** Libellés UI — parcours inscription / connexion / récupération MDP. */

export const AUTH_SIGNUP_EMAIL_SENT =
  "Un code à 6 chiffres a été envoyé à votre adresse e-mail. Ouvrez votre messagerie (vérifiez les spams) et saisissez le code ci-dessous — ne cliquez pas sur un éventuel lien tant que vous n’avez pas créé votre mot de passe.";

export const AUTH_SIGNUP_SMS_SENT =
  "Un code à 6 chiffres a été envoyé sur votre téléphone. Vérifiez vos SMS ou WhatsApp (selon votre opérateur), puis saisissez le code ci-dessous.";

export const AUTH_SIGNUP_EMAIL_RESENT = "Un nouveau code à 6 chiffres a été envoyé par e-mail.";

export const AUTH_SIGNUP_SMS_RESENT = "Un nouveau code à 6 chiffres a été envoyé (SMS ou WhatsApp).";

export const AUTH_SIGNUP_LINK_VERIFIED_PASSWORD =
  "Votre e-mail est vérifié. Choisissez un mot de passe pour terminer la création du compte et vous connecter ensuite avec votre numéro ou votre e-mail.";

export const AUTH_SIGNUP_OTP_VERIFIED_PASSWORD_EMAIL =
  "E-mail vérifié. Choisissez un mot de passe : vous pourrez ensuite vous connecter avec votre numéro ou cet e-mail.";

export const AUTH_SIGNUP_OTP_VERIFIED_PASSWORD_PHONE =
  "Numéro vérifié. Choisissez un mot de passe : vous pourrez ensuite vous connecter avec votre téléphone ou votre e-mail si vous l’avez renseigné.";

export const AUTH_RESET_EMAIL_SENT =
  "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé. Ouvrez le lien dans l’e-mail pour choisir un nouveau mot de passe (valable quelques minutes).";

export const AUTH_RESET_SMS_SENT =
  "Un code à 6 chiffres a été envoyé sur votre téléphone. Saisissez-le ci-dessous pour choisir un nouveau mot de passe.";

export const AUTH_RESET_SMS_RESENT = "Un nouveau code à 6 chiffres a été envoyé (SMS ou WhatsApp).";

export const AUTH_RESET_OTP_VERIFIED_PASSWORD =
  "Numéro vérifié. Choisissez un nouveau mot de passe (au moins 6 caractères).";

export const AUTH_RESET_PASSWORD_DONE = "Mot de passe mis à jour. Redirection…";

export const AUTH_CALLBACK_LINK_EXPIRED =
  "Ce lien n’est plus valide ou a déjà été utilisé. Demandez un nouveau code ou un nouveau lien depuis l’application.";

export const AUTH_EMAIL_RATE_LIMIT_FR =
  "Trop de codes ou d’e-mails envoyés récemment. Attendez environ une heure avant de réessayer, ou testez l’inscription avec le numéro de téléphone (SMS) sans e-mail facultatif.";

export const AUTH_SMS_RATE_LIMIT_FR =
  "Trop de codes SMS envoyés récemment. Patientez quelques minutes avant de demander un nouveau code.";

/** Traduit les erreurs Supabase Auth courantes (sinon message anglais brut). */
export function mapAuthErrorToFrench(message: string): string {
  const m = message.trim().toLowerCase();
  if (!m) return message;
  if (m.includes("email rate") || m.includes("over_email_send_rate")) {
    return AUTH_EMAIL_RATE_LIMIT_FR;
  }
  if (m.includes("sms rate") || m.includes("over_sms_send_rate")) {
    return AUTH_SMS_RATE_LIMIT_FR;
  }
  if (m.includes("token has expired") || m.includes("otp_expired")) {
    return "Ce code a expiré. Demandez un nouveau code.";
  }
  if (m.includes("invalid otp") || m.includes("token is invalid")) {
    return "Code incorrect. Vérifiez les 6 chiffres ou demandez un nouveau code.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "Un compte existe déjà avec cet identifiant. Connectez-vous ou utilisez « Mot de passe oublié ».";
  }
  if (m.includes("invalid login credentials")) {
    return "Identifiant ou mot de passe incorrect.";
  }
  return message;
}
