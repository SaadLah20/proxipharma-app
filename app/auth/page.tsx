"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Cross, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { ensurePatientProfile } from "@/lib/ensure-patient-profile";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Débogage auth / OTP SMS : Chrome (navigateur externe), pas l’aperçu intégré à l’IDE — voir AGENTS.md.

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

type AuthMethod = "phone" | "email";
type PhoneMode = "login_pw" | "sms";
type PhoneSmsStep = "collect" | "otp" | "password";

function isSuccessMessage(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("créé") ||
    m.includes("créée") ||
    m.includes("envoyé") ||
    m.includes("envoyée") ||
    m.includes("réinitialisation") ||
    m.includes("vérifiez votre boîte") ||
    m.includes("mot de passe enregistré")
  );
}

function AuthForm({ initialLogin }: { initialLogin: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect")?.trim() || "";
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "";

  const [authMethod, setAuthMethod] = useState<AuthMethod>("phone");
  const [phoneMode, setPhoneMode] = useState<PhoneMode>(() => (initialLogin ? "login_pw" : "sms"));
  const [phoneSmsStep, setPhoneSmsStep] = useState<PhoneSmsStep>("collect");
  const [phoneE164, setPhoneE164] = useState("");

  const [fullName, setFullName] = useState("");
  const [mobileRaw, setMobileRaw] = useState("");
  const [otp, setOtp] = useState("");
  const [smsNewPassword, setSmsNewPassword] = useState("");
  const [smsNewPassword2, setSmsNewPassword2] = useState("");
  const [smsOptionalEmail, setSmsOptionalEmail] = useState("");

  const [isLogin, setIsLogin] = useState(initialLogin);
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
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

  const switchToPhoneTab = () => {
    setAuthMethod("phone");
    setPhoneSmsStep("collect");
    setOtp("");
    setSmsNewPassword("");
    setSmsNewPassword2("");
    setSmsOptionalEmail("");
    setMessage("");
  };

  const switchToEmailTab = () => {
    setAuthMethod("email");
    setMessage("");
  };

  const goSmsFlow = () => {
    setPhoneMode("sms");
    setPhoneSmsStep("collect");
    setOtp("");
    setSmsNewPassword("");
    setSmsNewPassword2("");
    setSmsOptionalEmail("");
    setMessage("");
  };

  const goPhonePasswordLogin = () => {
    setPhoneMode("login_pw");
    setPhoneSmsStep("collect");
    setOtp("");
    setMessage("");
  };

  const sendPhoneOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const e164 = normalizePhoneToE164(mobileRaw);
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
    setPhoneSmsStep("otp");
    setMessage("Code SMS envoyé. Saisissez le code reçu.");
  };

  const verifyPhoneOtp = async (e: FormEvent<HTMLFormElement>) => {
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
    setPhoneSmsStep("password");
    setMessage("Numéro vérifié. Choisissez un mot de passe pour vos prochaines connexions (sans nouveau SMS).");
  };

  const submitSmsPasswordAndOptionalEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (smsNewPassword.length < 6) {
      setMessage("Le mot de passe doit contenir au moins 6 caractères.");
      setLoading(false);
      return;
    }
    if (smsNewPassword !== smsNewPassword2) {
      setMessage("Les deux mots de passe ne correspondent pas.");
      setLoading(false);
      return;
    }

    const optMail = smsOptionalEmail.trim();
    if (optMail && !optMail.includes("@")) {
      setMessage("E-mail facultatif invalide (laissez vide si vous n’en voulez pas).");
      setLoading(false);
      return;
    }

    const payload: { password: string; email?: string } = { password: smsNewPassword };
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
    setMessage("Mot de passe enregistré. Redirection…");
    await redirectAfterAuth();
  };

  const resendOtp = async () => {
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

  const phonePasswordLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const e164 = normalizePhoneToE164(mobileRaw);
    if (!e164) {
      setMessage("Numéro invalide. Utilisez le format international (ex. +212612345678 ou 0612345678).");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      phone: e164,
      password,
    });

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

  const handleEmailSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!isLogin && whatsapp.trim().length < 8) {
      setMessage("Le numéro WhatsApp est obligatoire et doit être valide.");
      setLoading(false);
      return;
    }

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName,
          whatsapp,
        },
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session?.user) {
      const { error: pe } = await ensurePatientProfile(data.session.user);
      if (pe) {
        setMessage(pe.message);
        setLoading(false);
        return;
      }
      setLoading(false);
      await redirectAfterAuth();
      return;
    }

    setMessage(
      "Compte créé. Si la confirmation e-mail est activée sur le projet, ouvrez le lien reçu puis reconnectez-vous ici (onglet E-mail)."
    );
    setIsLogin(true);
    setLoading(false);
  };

  const sendPasswordReset = async () => {
    const em = email.trim();
    if (!em) {
      setMessage("Saisissez votre e-mail pour recevoir le lien de réinitialisation.");
      return;
    }
    setLoading(true);
    setMessage("");
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/update-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("Si un compte existe avec cet e-mail, un lien de réinitialisation vient d’être envoyé. Vérifiez votre boîte.");
    setForgotOpen(false);
  };

  const phoneTitle =
    authMethod !== "phone"
      ? ""
      : phoneMode === "login_pw"
        ? "Connexion téléphone"
        : phoneSmsStep === "otp"
          ? "Code SMS"
          : phoneSmsStep === "password"
            ? "Mot de passe"
            : "Inscription ou code SMS";

  const phoneSubtitle =
    authMethod !== "phone"
      ? ""
      : phoneMode === "login_pw"
        ? "Utilisez le même numéro qu’à l’inscription et le mot de passe défini après la première vérification par SMS."
        : phoneSmsStep === "password"
          ? "Ensuite vous pourrez vous connecter avec ce numéro et ce mot de passe, sans nouveau code à chaque fois. L’e-mail reste facultatif (vous pouvez aussi l’ajouter dans Paramètres)."
          : "Première étape : un code par SMS pour vérifier le numéro. Ensuite vous choisirez un mot de passe.";

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
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {authMethod === "phone" ? phoneTitle : isLogin ? "Connexion" : "Créer un compte"}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {authMethod === "phone" ? phoneSubtitle : "Comptes déjà créés avec e-mail, ou comptes pharmacien / admin."}
            </p>
          </div>
        </div>

        <div className="mb-4 flex gap-1 rounded-xl border border-border bg-muted/30 p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg py-2 text-center text-xs font-semibold sm:text-sm",
              authMethod === "phone" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => switchToPhoneTab()}
          >
            Téléphone
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-lg py-2 text-center text-xs font-semibold sm:text-sm",
              authMethod === "email" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => switchToEmailTab()}
          >
            E-mail
          </button>
        </div>

        {authMethod === "phone" ? (
          phoneMode === "login_pw" ? (
            <div className="space-y-3">
              <form className="space-y-3" onSubmit={(ev) => void phonePasswordLogin(ev)}>
                <input
                  type="tel"
                  placeholder="Mobile (ex. 0612345678 ou +212612345678)"
                  className={fieldClass}
                  value={mobileRaw}
                  onChange={(e) => setMobileRaw(e.target.value)}
                  required
                  autoComplete="tel"
                />
                <input
                  type="password"
                  placeholder="Mot de passe"
                  className={fieldClass}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
                <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
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
              <button
                type="button"
                onClick={() => goSmsFlow()}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-auto w-full py-2 text-sm font-semibold text-primary"
                )}
              >
                Première visite, pas de mot de passe ou code de secours → SMS
              </button>
            </div>
          ) : phoneSmsStep === "collect" ? (
            <div className="space-y-3">
              <form className="space-y-3" onSubmit={(ev) => void sendPhoneOtp(ev)}>
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
                  placeholder="Mobile (ex. 0612345678 ou +212612345678)"
                  className={fieldClass}
                  value={mobileRaw}
                  onChange={(e) => setMobileRaw(e.target.value)}
                  required
                  autoComplete="tel"
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Après le code SMS, vous choisirez un mot de passe pour les prochaines connexions avec ce numéro.
                </p>
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
              <button
                type="button"
                onClick={() => goPhonePasswordLogin()}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "h-auto w-full py-2 text-sm font-semibold text-primary"
                )}
              >
                Déjà un mot de passe ? Connexion sans SMS
              </button>
            </div>
          ) : phoneSmsStep === "otp" ? (
            <form className="space-y-3" onSubmit={(ev) => void verifyPhoneOtp(ev)}>
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
                  onClick={() => void resendOtp()}
                >
                  Renvoyer le SMS
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  disabled={loading}
                  onClick={() => {
                    setPhoneSmsStep("collect");
                    setOtp("");
                    setMessage("");
                  }}
                >
                  Changer de numéro
                </Button>
              </div>
            </form>
          ) : (
            <form className="space-y-3" onSubmit={(ev) => void submitSmsPasswordAndOptionalEmail(ev)}>
              <input
                type="password"
                placeholder="Nouveau mot de passe (min. 6 caractères)"
                className={fieldClass}
                value={smsNewPassword}
                onChange={(e) => setSmsNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <input
                type="password"
                placeholder="Confirmer le mot de passe"
                className={fieldClass}
                value={smsNewPassword2}
                onChange={(e) => setSmsNewPassword2(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
              <input
                type="email"
                placeholder="E-mail (facultatif, récupération)"
                className={fieldClass}
                value={smsOptionalEmail}
                onChange={(e) => setSmsOptionalEmail(e.target.value)}
                autoComplete="email"
              />
              <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Patientez…
                  </>
                ) : (
                  "Enregistrer et continuer"
                )}
              </Button>
            </form>
          )
        ) : (
          <form className="space-y-3" onSubmit={(ev) => void handleEmailSubmit(ev)}>
            {!isLogin && (
              <>
                <input
                  type="text"
                  placeholder="Nom complet"
                  className={fieldClass}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
                <input
                  type="text"
                  placeholder="WhatsApp (obligatoire à l’inscription)"
                  className={fieldClass}
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  required={!isLogin}
                  autoComplete="tel"
                />
              </>
            )}

            <input
              type="email"
              placeholder="E-mail"
              className={fieldClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <input
              type="password"
              placeholder="Mot de passe"
              className={fieldClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {isLogin ? (
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
                  <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs">
                    <p className="text-muted-foreground">
                      Un lien sécurisé sera envoyé à l’adresse ci-dessus. Ajoutez{" "}
                      <span className="font-mono text-[10px] text-foreground">/auth/update-password</span> dans les
                      URL de redirection autorisées du projet Supabase.
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
            ) : null}

            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Patientez…
                </>
              ) : isLogin ? (
                "Se connecter"
              ) : (
                "Créer le compte"
              )}
            </Button>
          </form>
        )}

        {authMethod === "email" ? (
          <button
            type="button"
            onClick={() => {
              setIsLogin((v) => !v);
              setMessage("");
              setForgotOpen(false);
            }}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "mt-3 h-auto w-full py-2 text-sm font-semibold text-primary"
            )}
          >
            {isLogin ? "Pas de compte ? Inscription" : "Déjà un compte ? Connexion"}
          </button>
        ) : null}

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
  const mode = searchParams.get("mode");
  const initialLogin = mode !== "signup";
  return <AuthForm key={mode ?? "login"} initialLogin={initialLogin} />;
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
