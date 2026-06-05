export const authFr = {
  signup: {
    emailSent:
      "Un code à 6 chiffres a été envoyé à votre adresse e-mail. Ouvrez votre messagerie (vérifiez les spams) et saisissez le code ci-dessous — ne cliquez pas sur un éventuel lien tant que vous n'avez pas créé votre mot de passe.",
    smsSent:
      "Un code à 6 chiffres a été envoyé sur votre téléphone. Vérifiez vos SMS ou WhatsApp (selon votre opérateur), puis saisissez le code ci-dessous.",
    emailResent: "Un nouveau code à 6 chiffres a été envoyé par e-mail.",
    smsResent: "Un nouveau code à 6 chiffres a été envoyé (SMS ou WhatsApp).",
    linkVerifiedPassword:
      "Votre e-mail est vérifié. Choisissez un mot de passe pour terminer la création du compte et vous connecter ensuite avec votre numéro ou votre e-mail.",
    otpVerifiedPasswordEmail:
      "E-mail vérifié. Choisissez un mot de passe : vous pourrez ensuite vous connecter avec votre numéro ou cet e-mail.",
    otpVerifiedPasswordPhone:
      "Numéro vérifié. Choisissez un mot de passe : vous pourrez ensuite vous connecter avec votre téléphone ou votre e-mail si vous l'avez renseigné.",
    phoneAlreadyRegistered:
      "Ce numéro est déjà associé à un compte. Utilisez Connexion avec votre mot de passe.",
    emailAlreadyRegistered:
      "Cet e-mail est déjà associé à un compte. Utilisez Connexion avec votre mot de passe, ou inscrivez-vous avec le téléphone seul (sans e-mail).",
  },
  reset: {
    emailSent:
      "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé. Ouvrez le lien dans l'e-mail pour choisir un nouveau mot de passe (valable quelques minutes).",
    smsSent:
      "Un code à 6 chiffres a été envoyé sur votre téléphone. Saisissez-le ci-dessous pour choisir un nouveau mot de passe.",
    smsResent: "Un nouveau code à 6 chiffres a été envoyé (SMS ou WhatsApp).",
    otpVerifiedPassword: "Numéro vérifié. Choisissez un nouveau mot de passe (au moins 6 caractères).",
    passwordDone: "Mot de passe mis à jour. Redirection…",
    phoneNotFound:
      "Aucun compte n'est associé à ce numéro. Vérifiez le numéro ou contactez votre administrateur ProxiPharma.",
  },
  callback: {
    linkExpired:
      "Ce lien n'est plus valide ou a déjà été utilisé. Demandez un nouveau code ou un nouveau lien depuis l'application.",
    finalizing: "Finalisation…",
    backToAuth: "Créer un compte / connexion",
  },
  updatePassword: {
    title: "Nouveau mot de passe",
    subtitle: "Définissez un nouveau mot de passe pour votre compte (lien de récupération e-mail).",
    verifyingLink: "Vérification du lien…",
    save: "Enregistrer",
  },
  errors: {
    emailRateLimit:
      "Trop de codes ou d'e-mails envoyés récemment. Attendez environ une heure avant de réessayer, ou testez l'inscription avec le numéro de téléphone (SMS) sans e-mail facultatif.",
    smsRateLimit: "Trop de codes SMS envoyés récemment. Patientez quelques minutes avant de demander un nouveau code.",
    otpExpired: "Ce code a expiré. Demandez un nouveau code.",
    otpInvalid: "Code incorrect. Vérifiez les 6 chiffres ou demandez un nouveau code.",
    alreadyRegistered:
      "Un compte existe déjà avec cet identifiant. Connectez-vous ou utilisez « Mot de passe oublié ».",
    invalidCredentials: "Identifiant ou mot de passe incorrect.",
    noAccountForPhone: "Aucun compte pour ce numéro.",
  },
  page: {
    titleLogin: "Connexion",
    titleSignup: "Créer un compte",
    titleSignupOtpEmail: "Code e-mail",
    titleSignupOtpSms: "Code SMS",
    titleChoosePassword: "Choisissez un mot de passe",
    titleForgotOtp: "Code SMS",
    titleForgotPassword: "Nouveau mot de passe",
    subtitleLogin: "Identifiant (téléphone ou e-mail) et mot de passe.",
    subtitleSignupForm:
      "Téléphone obligatoire. E-mail facultatif : si vous le renseignez, le code part par e-mail (recommandé si les SMS sont bloqués, ex. Inwi). Sinon, vérifiez SMS ou WhatsApp.",
    subtitleSignupOtpEmail: "Saisissez le code à 6 chiffres reçu par e-mail (pas le lien).",
    subtitleSignupOtpSms: "Saisissez le code à 6 chiffres reçu par SMS ou WhatsApp.",
    subtitleSignupPassword:
      "Définissez le mot de passe de votre compte. Vous vous connecterez ensuite avec votre numéro ou votre e-mail.",
    subtitleForgotOtp: "Saisissez le code à 6 chiffres reçu par SMS ou WhatsApp.",
    subtitleForgotPassword: "Choisissez un nouveau mot de passe pour votre compte officine ou patient.",
    placeholderLoginId: "Téléphone ou e-mail",
    placeholderPassword: "Mot de passe",
    placeholderFullName: "Nom complet",
    placeholderPhone: "Téléphone (ex. 0612345678 ou +212612345678)",
    placeholderEmailOptional: "E-mail (facultatif)",
    placeholderOtp: "Code à 6 chiffres",
    placeholderNewPassword: "Nouveau mot de passe (min. 6 caractères)",
    placeholderConfirmPassword: "Confirmer le mot de passe",
    placeholderSignupPassword: "Mot de passe (min. 6 caractères)",
    buttonLogin: "Se connecter",
    buttonForgotPassword: "Mot de passe oublié ?",
    buttonReceiveSmsCode: "Recevoir un code SMS",
    buttonSendEmailLink: "Envoyer le lien par e-mail",
    buttonValidateOtp: "Valider le code",
    buttonResendSms: "Renvoyer le SMS",
    buttonResendEmail: "Renvoyer l'e-mail",
    buttonSaveNewPassword: "Enregistrer le nouveau mot de passe",
    buttonReceiveVerificationCode: "Recevoir le code de vérification",
    buttonEditInfo: "Modifier mes infos",
    buttonCreateAccount: "Créer mon compte et continuer",
    buttonSavePassword: "Enregistrer mon mot de passe",
    toggleHasAccount: "Déjà un compte ? Connexion",
    toggleNoAccount: "Pas de compte ? Créer un compte",
    forgotHint:
      "Téléphone : code SMS à 6 chiffres puis nouveau mot de passe. E-mail : lien de réinitialisation.",
    otpSentToPhone: "Code envoyé au {phone}",
    otpSentToEmail: "Code envoyé à {email}",
    otpCheckSmsWhatsapp: "Consultez vos SMS ou WhatsApp, puis saisissez les 6 chiffres.",
    otpCheckSmsWhatsappOperator:
      "Consultez vos SMS ou WhatsApp (selon votre opérateur), puis saisissez les 6 chiffres.",
    otpCheckEmailSpam:
      "Vérifiez votre boîte e-mail (et les spams). Saisissez uniquement le code à 6 chiffres — si vous ouvrez un lien par erreur, vous serez invité à choisir votre mot de passe ensuite.",
    otpAccountPhone: "Tél. du compte : {phone}",
    validationInvalidLoginId: "Saisissez un numéro valide (ex. 0612345678) ou une adresse e-mail.",
    validationInvalidPhone: "Numéro invalide. Utilisez le format international (ex. +212612345678 ou 0612345678).",
    validationNameTooShort: "Indiquez au moins votre prénom et nom (2 caractères minimum).",
    validationInvalidOptionalEmail: "E-mail facultatif invalide (laissez vide si vous n'en voulez pas).",
    validationOtpTooShortEmail: "Saisissez le code à 6 chiffres reçu par e-mail.",
    validationOtpTooShortSms: "Saisissez le code à 6 chiffres reçu par SMS.",
    validationSessionNotFound: "Session introuvable après vérification. Réessayez.",
    validationPasswordTooShort: "Le mot de passe doit contenir au moins 6 caractères.",
    validationPasswordMismatch: "Les deux mots de passe ne correspondent pas.",
    validationPhoneLinkAfterSignup:
      "Compte créé mais le téléphone n'a pas pu être lié pour la connexion. Réessayez depuis Mes paramètres ou contactez le support.",
    validationUserNotFoundAfterUpdate: "Utilisateur introuvable après mise à jour.",
    successAccountCreated: "Compte créé. Redirection…",
    validationForgotNeedPhone:
      "Pour réinitialiser par SMS, saisissez votre numéro de téléphone dans le champ identifiant.",
    validationForgotNeedEmail:
      "Pour réinitialiser par e-mail, saisissez votre adresse e-mail dans le champ identifiant.",
    validationResetRequestFailed: "Impossible d'envoyer la demande. Vérifiez votre connexion et réessayez.",
    validationResetRequestLater: "Impossible d'envoyer la demande pour le moment. Réessayez plus tard.",
  },
};
