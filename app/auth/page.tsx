"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cross, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { ensurePatientProfile } from "@/lib/ensure-patient-profile";
import { parseLoginIdentifier } from "@/lib/auth-login-identifier";
import {
  authUserLooksLikeFreshSignup,
  checkPhoneAvailableForSignup,
  SIGNUP_PHONE_ALREADY_REGISTERED_FR,
} from "@/lib/auth-signup-phone";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Débogage auth / OTP SMS : Chrome (navigateur externe), pas l’aperçu intégré à l’IDE — voir AGENTS.md.

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

type SignupStep = "form" | "otp" | "password";

function isSuccessMessage(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("créé") ||
    m.includes("créée") ||
    m.includes("envoyé") ||
    m.includes("envoyée") ||
    m.includes("réinitialisation") ||
    m.includes("vérifiez votre boîte") ||
    m.includes("mot de passe enregistré") ||
    m.includes("redirection")
  );
}

function AuthForm({ isSignup }: { isSignup: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.trim() || "";
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "";

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);

  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [phoneE164, setPhoneE164] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const redirectAfterAuth = useCallback(async () => {
    const dest = safeRedirect || (await defaultPathAfterAuth());
    router.push(dest);
  }, [router, safeRedirect]);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const dest = safeRedirect || (await defaultPathAfterAuth());
        router.replace(dest);
      }
    };

    void checkSession();
  }, [router, safeRedirect]);

  const switchMode = (signup: boolean) => {
    const q = new URLSearchParams(searchParams.toString());
    if (signup) {
      q.set("mode", "signup");
    } else {
      q.delete("mode");
    }
    const path = q.toString() ? `/auth?${q}` : "/auth";
    router.replace(path);
  };

  const resetSignupFlow = () => {
    setSignupStep("form");
    setOtp("");
    setNewPassword("");
    setNewPassword2("");
    setPhoneE164("");
    setMessage("");
  };

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const id = parseLoginIdentifier(loginId);
    if (!id) {
      setMessage("Saisissez un numéro valide (ex. 0612345678) ou une adresse e-mail.");
      setLoading(false);
      return;
    }

    const credentials =
      id.kind === "email"
        ? { email: id.email, password: loginPassword }
        : { phone: id.phone, password: loginPassword };

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.session?.user;
    if (user) {
      const { error: pe } = await ensurePatientProfile(user, {
        full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
        whatsapp: typeof user.user_metadata?.whatsapp === "string" ? user.user_metadata.whatsapp : undefined,
      });
      if (pe) {
        setMessage(pe.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    await redirectAfterAuth();
  };

  const sendSignupSms = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const e164 = normalizePhoneToE164(signupPhone);
    if (!e164) {
      setMessage("Numéro invalide. Utilisez le format international (ex. +212612345678 ou 0612345678).");
      setLoading(false);
      return;
    }

    if (fullName.trim().length < 2) {
      setMessage("Indiquez au moins votre prénom et nom (2 caractères minimum).");
      setLoading(false);
      return;
    }

    const optMail = signupEmail.trim();
    if (optMail && !optMail.includes("@")) {
      setMessage("E-mail facultatif invalide (laissez vide si vous n’en voulez pas).");
      setLoading(false);
      return;
    }

    const phoneCheck = await checkPhoneAvailableForSignup(signupPhone);
    if (phoneCheck.error === "invalid_phone" || !phoneCheck.e164) {
      setMessage("Numéro invalide. Utilisez le format international (ex. +212612345678 ou 0612345678).");
      setLoading(false);
      return;
    }
    if (!phoneCheck.available) {
      setMessage(SIGNUP_PHONE_ALREADY_REGISTERED_FR);
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      phone: e164,
      options: {
        channel: "sms",
        shouldCreateUser: true,
        data: {
          full_name: fullName.trim(),
          whatsapp: e164,
        },
      },
    });

    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setPhoneE164(e164);
    setSignupStep("otp");
    setMessage("Code SMS envoyé. Saisissez le code reçu.");
  };

  const verifySignupOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      setMessage("Saisissez le code à 6 chiffres reçu par SMS.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneE164,
      token: code,
      type: "sms",
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const user = data.session?.user;
    if (!user) {
      setMessage("Session introuvable après vérification. Réessayez.");
      setLoading(false);
      return;
    }

    if (!authUserLooksLikeFreshSignup(user.created_at)) {
      await supabase.auth.signOut();
      setMessage(SIGNUP_PHONE_ALREADY_REGISTERED_FR);
      setLoading(false);
      resetSignupFlow();
      return;
    }

    const { error: pe } = await ensurePatientProfile(user, {
      full_name: fullName.trim(),
      whatsapp: phoneE164,
    });
    if (pe) {
      setMessage(pe.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSignupStep("password");
    setMessage("Numéro vérifié. Choisissez un mot de passe pour vous connecter la prochaine fois.");
  };

  const finishSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (newPassword.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }
    if (newPassword !== newPassword2) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    const optMail = signupEmail.trim().toLowerCase();
    const payload: { password: string; email?: string } = { password: newPassword };
    if (optMail) {
      payload.email = optMail;
    }

    const { error: ue } = await supabase.auth.updateUser(payload);
    if (ue) {
      setMessage(ue.message);
      setLoading(false);
      return;
    }

    const { data: userData, error: guErr } = await supabase.auth.getUser();
    if (guErr || !userData.user) {
      setMessage(guErr?.message ?? "Utilisateur introuvable après mise à jour.");
      setLoading(false);
      return;
    }

    const { error: pe } = await ensurePatientProfile(userData.user, {
      full_name: fullName.trim(),
      whatsapp: phoneE164,
    });
    if (pe) {
      setMessage(pe.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    setMessage("Compte créé. Redirection…");
    await redirectAfterAuth();
  };

  const resendSignupOtp = async () => {
    setLoading(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      phone: phoneE164,
      options: {
        channel: "sms",
        shouldCreateUser: true,
        data: {
          full_name: fullName.trim(),
          whatsapp: phoneE164,
        },
      },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Nouveau code envoyé par SMS.");
  };

  const sendPasswordReset = async () => {
    const id = parseLoginIdentifier(loginId);
    if (!id || id.kind !== "email") {
      setMessage("Pour réinitialiser par e-mail, saisissez votre adresse e-mail dans le champ identifiant.");
      return;
    }
    setLoading(true);
    setMessage("");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(id.email, {
      redirectTo: `${origin}/auth/update-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé.");
    setForgotOpen(false);
  };

  const title = isSignup
    ? signupStep === "form"
      ? "Créer un compte"
      : signupStep === "otp"
        ? "Code SMS"
        : "Choisissez un mot de passe"
    : "Connexion";

  const subtitle = isSignup
    ? signupStep === "form"
      ? "Nom, numéro de téléphone et e-mail facultatif. Vous recevrez un SMS pour vérifier le numéro, puis vous choisirez un mot de passe."
      : signupStep === "otp"
        ? "Saisissez le code reçu par SMS."
        : "Ce mot de passe servira pour vos prochaines connexions (numéro ou e-mail si vous l’avez renseigné)."
    : "Numéro de téléphone ou adresse e-mail, et votre mot de passe.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
      <Link
        href="/"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 w-fit gap-1.5 px-2 text-sm font-semibold text-primary"
        )}
      >
        <ArrowLeft className="size-4" aria-hidden />
        Retour à l&apos;annuaire
      </Link>

      <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
            aria-hidden
          >
            <Cross className="size-5" strokeWidth={2.25} />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
        </div>

        {!isSignup ? (
          <form className="space-y-3" onSubmit={(ev) => void login(ev)}>
            <input
              type="text"
              placeholder="Téléphone ou e-mail"
              className={fieldClass}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              type="password"
              placeholder="Mot de passe"
              className={fieldClass}
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="current-password"
            />
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setForgotOpen((v) => !v);
                  setMessage("");
                }}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                Mot de passe oublié ?
              </button>
              {forgotOpen ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Un lien sera envoyé à l’adresse e-mail saisie ci-dessus (identifiant de type e-mail).
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={loading}
                    onClick={() => void sendPasswordReset()}
                  >
                    Envoyer le lien par e-mail
                  </Button>
                </div>
              ) : null}
            </div>
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                "Se connecter"
              )}
            </Button>
          </form>
        ) : signupStep === "form" ? (
          <form className="space-y-3" onSubmit={(ev) => void sendSignupSms(ev)}>
            <input
              type="text"
              placeholder="Nom complet"
              className={fieldClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
            <input
              type="tel"
              placeholder="Téléphone (ex. 0612345678 ou +212612345678)"
              className={fieldClass}
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              required
              autoComplete="tel"
            />
            <input
              type="email"
              placeholder="E-mail (facultatif)"
              className={fieldClass}
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                "Recevoir le code par SMS"
              )}
            </Button>
          </form>
        ) : signupStep === "otp" ? (
          <form className="space-y-3" onSubmit={(ev) => void verifySignupOtp(ev)}>
            <p className="text-xs text-muted-foreground">
              Code envoyé au <span className="font-mono font-medium text-foreground">{phoneE164}</span>
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Code à 6 chiffres"
              className={fieldClass}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={12}
              required
            />
            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                "Valider le code"
              )}
            </Button>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => void resendSignupOtp()}
              >
                Renvoyer le SMS
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => resetSignupFlow()}
              >
                Modifier mes infos
              </Button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(ev) => void finishSignup(ev)}>
            <input
              type="password"
              placeholder="Mot de passe (min. 6 caractères)"
              className={fieldClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder="Confirmer le mot de passe"
              className={fieldClass}
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : (
                "Créer mon compte et continuer"
              )}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => {
            setMessage("");
            setForgotOpen(false);
            if (isSignup) {
              resetSignupFlow();
              switchMode(false);
            } else {
              switchMode(true);
            }
          }}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "mt-3 h-auto w-full py-2 text-sm font-semibold text-primary"
          )}
        >
          {isSignup ? "Déjà un compte ? Connexion" : "Pas de compte ? Créer un compte"}
        </button>

        {message ? (
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              isSuccessMessage(message)
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                : "border-border bg-muted/50 text-foreground"
            )}
          >
            {message}
          </p>
        ) : null}
      </div>
    </main>
  );
}

function AuthFormGate() {
  const searchParams = useSearchParams();
  const isSignup = searchParams.get("mode") === "signup";
  return <AuthForm key={isSignup ? "signup" : "login"} isSignup={isSignup} />;
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center gap-2 bg-background p-6 text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
          <span className="text-sm font-medium text-foreground">Chargement…</span>
        </main>
      }
    >
      <AuthFormGate />
    </Suspense>
  );
}
