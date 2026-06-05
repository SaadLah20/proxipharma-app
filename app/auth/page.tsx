"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft, Cross, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { defaultPathAfterAuth } from "@/lib/post-auth-redirect";
import { ensurePatientProfile } from "@/lib/ensure-patient-profile";
import { parseLoginIdentifier } from "@/lib/auth-login-identifier";
import { checkPhoneAvailableForSignup, normalizeSignupEmail } from "@/lib/auth-signup-phone";
import {
  SIGNUP_META_PASSWORD_PENDING,
  signupCanContinueAfterOtpVerify,
  signupOtpChannelFromUser,
  signupProfileFromUser,
  userNeedsSignupPassword,
} from "@/lib/auth-signup-flow";
import { userIsProvisionedPharmacist } from "@/lib/provisioned-pharmacist-auth";
import { checkPhoneRegisteredForPasswordReset } from "@/lib/auth-phone-password-reset";
import { mapAuthErrorToLocale } from "@/lib/i18n/map-auth-error";
import { linkSignupPhoneOnAuth, syncPhoneBeforeLogin } from "@/lib/auth-client-phone-link";
import { normalizePhoneToE164 } from "@/lib/phone-e164";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Débogage auth / OTP SMS : Chrome (navigateur externe), pas l’aperçu intégré à l’IDE — voir AGENTS.md.

const fieldClass =
  "w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

type SignupStep = "form" | "otp" | "password";

function AuthForm({ isSignup }: { isSignup: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const redirectTo = searchParams.get("redirect")?.trim() || "";
  const safeRedirect =
    redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : "";

  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotResetStep, setForgotResetStep] = useState<"idle" | "otp" | "password">("idle");
  const [forgotPhoneE164, setForgotPhoneE164] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotNewPassword2, setForgotNewPassword2] = useState("");

  const [signupStep, setSignupStep] = useState<SignupStep>("form");
  const [phoneE164, setPhoneE164] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  /** OTP par e-mail si l’utilisateur a renseigné un e-mail (SMS Inwi souvent bloqué). */
  const [signupOtpChannel, setSignupOtpChannel] = useState<"phone" | "email">("phone");
  const [signupEmailForOtp, setSignupEmailForOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageSuccess, setMessageSuccess] = useState(false);

  const showMessage = (msg: string, success = false) => {
    setMessage(msg);
    setMessageSuccess(success);
  };

  const redirectAfterAuth = useCallback(async () => {
    const dest = safeRedirect || (await defaultPathAfterAuth());
    router.push(dest);
  }, [router, safeRedirect]);

  useEffect(() => {
    const step = searchParams.get("step");
    const tid = window.setTimeout(() => {
      if (step === "otp") setSignupStep("otp");
      else if (step === "password") setSignupStep("password");
    }, 0);
    return () => window.clearTimeout(tid);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || cancelled) return;

      if (userNeedsSignupPassword(user)) {
        const profile = signupProfileFromUser(user);
        const fromLink = searchParams.get("from") === "link";
        window.setTimeout(() => {
          if (cancelled) return;
          if (profile.full_name) setFullName(profile.full_name);
          if (profile.whatsapp) setPhoneE164(profile.whatsapp);
          if (profile.email) {
            setSignupEmail(profile.email);
            setSignupEmailForOtp(profile.email);
            setSignupOtpChannel(signupOtpChannelFromUser(user));
          } else {
            setSignupOtpChannel("phone");
          }
          setSignupStep("password");
          if (fromLink) showMessage(t("signup.linkVerifiedPassword"), true);
        }, 0);
        if (!isSignup) {
          const q = new URLSearchParams(searchParams.toString());
          q.set("mode", "signup");
          q.set("step", "password");
          if (fromLink) q.set("from", "link");
          if (userIsProvisionedPharmacist(user)) q.set("provisioned", "1");
          router.replace(`/auth?${q}`);
        }
        return;
      }

      if (isSignup) return;

      const dest = safeRedirect || (await defaultPathAfterAuth());
      router.replace(dest);
    };

    const tid = window.setTimeout(() => {
      void checkSession();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [router, safeRedirect, isSignup, searchParams]);

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

  const replaceSignupUrlStep = useCallback(
    (step: SignupStep) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("mode", "signup");
      if (step === "form") q.delete("step");
      else q.set("step", step);
      router.replace(`/auth?${q}`);
    },
    [router, searchParams]
  );

  const resetSignupFlow = () => {
    setSignupStep("form");
    setOtp("");
    setNewPassword("");
    setNewPassword2("");
    setPhoneE164("");
    setSignupOtpChannel("phone");
    setSignupEmailForOtp("");
    setMessage("");
    setMessageSuccess(false);
    replaceSignupUrlStep("form");
  };

  const login = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);

    const id = parseLoginIdentifier(loginId);
    if (!id) {
      showMessage(t("page.validationInvalidLoginId"));
      setLoading(false);
      return;
    }

    if (id.kind === "phone") {
      const sync = await syncPhoneBeforeLogin(id.phone, loginPassword);
      if (!sync.ok && sync.error) {
        const noProfileForSync = sync.error === "Aucun compte pour ce numéro.";
        if (!noProfileForSync) {
          setMessage(sync.error);
          setLoading(false);
          return;
        }
      }
    }

    const credentials =
      id.kind === "email"
        ? { email: id.email, password: loginPassword }
        : { phone: id.phone, password: loginPassword };

    const { data, error } = await supabase.auth.signInWithPassword(credentials);

    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      setLoading(false);
      return;
    }

    const user = data.session?.user;
    if (user?.user_metadata?.[SIGNUP_META_PASSWORD_PENDING] === true) {
      const profile = signupProfileFromUser(user);
      if (profile.full_name) setFullName(profile.full_name);
      if (profile.whatsapp) setPhoneE164(profile.whatsapp);
      setSignupStep("password");
      const q = new URLSearchParams();
      q.set("mode", "signup");
      q.set("step", "password");
      if (userIsProvisionedPharmacist(user)) q.set("provisioned", "1");
      if (safeRedirect) q.set("redirect", safeRedirect);
      router.replace(`/auth?${q}`);
      setLoading(false);
      return;
    }

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
    setMessageSuccess(false);

    const e164 = normalizePhoneToE164(signupPhone);
    if (!e164) {
      showMessage(t("page.validationInvalidPhone"));
      setLoading(false);
      return;
    }

    if (fullName.trim().length < 2) {
      showMessage(t("page.validationNameTooShort"));
      setLoading(false);
      return;
    }

    const optMail = normalizeSignupEmail(signupEmail);
    if (signupEmail.trim() && !optMail) {
      showMessage(t("page.validationInvalidOptionalEmail"));
      setLoading(false);
      return;
    }

    const phoneCheck = await checkPhoneAvailableForSignup(signupPhone);
    if (phoneCheck.error === "invalid_phone" || !phoneCheck.e164) {
      showMessage(t("page.validationInvalidPhone"));
      setLoading(false);
      return;
    }
    if (!phoneCheck.available) {
      showMessage(t("signup.phoneAlreadyRegistered"));
      setLoading(false);
      return;
    }

    setPhoneE164(e164);

    if (optMail) {
      const { error } = await supabase.auth.signInWithOtp({
        email: optMail,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: fullName.trim(),
            whatsapp: e164,
            signup_phone: e164,
            [SIGNUP_META_PASSWORD_PENDING]: true,
          },
        },
      });
      setLoading(false);
      if (error) {
        showMessage(mapAuthErrorToLocale(error.message, t));
        return;
      }
      setSignupOtpChannel("email");
      setSignupEmailForOtp(optMail);
      setSignupStep("otp");
      replaceSignupUrlStep("otp");
      showMessage(t("signup.emailSent"), true);
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
          [SIGNUP_META_PASSWORD_PENDING]: true,
        },
      },
    });

    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }

    setSignupOtpChannel("phone");
    setSignupEmailForOtp("");
    setSignupStep("otp");
    replaceSignupUrlStep("otp");
    showMessage(t("signup.smsSent"), true);
  };

  const verifySignupOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);

    const code = otp.replace(/\D/g, "");
    if (code.length < 6) {
      showMessage(
        signupOtpChannel === "email"
          ? t("page.validationOtpTooShortEmail")
          : t("page.validationOtpTooShortSms")
      );
      setLoading(false);
      return;
    }

    const { data, error } =
      signupOtpChannel === "email"
        ? await supabase.auth.verifyOtp({
            email: signupEmailForOtp,
            token: code,
            type: "email",
          })
        : await supabase.auth.verifyOtp({
            phone: phoneE164,
            token: code,
            type: "sms",
          });

    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      setLoading(false);
      return;
    }

    const user = data.session?.user;
    if (!user) {
      showMessage(t("page.validationSessionNotFound"));
      setLoading(false);
      return;
    }

    if (!signupCanContinueAfterOtpVerify(user)) {
      await supabase.auth.signOut();
      resetSignupFlow();
      showMessage(
        signupOtpChannel === "email"
          ? t("signup.emailAlreadyRegistered")
          : t("signup.phoneAlreadyRegistered")
      );
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
    await supabase.auth.updateUser({
      data: { [SIGNUP_META_PASSWORD_PENDING]: true },
    });

    setSignupStep("password");
    replaceSignupUrlStep("password");
    showMessage(
      signupOtpChannel === "email"
        ? t("signup.otpVerifiedPasswordEmail")
        : t("signup.otpVerifiedPasswordPhone"),
      true
    );
  };

  const finishSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);

    if (newPassword.length < 6) {
      showMessage(t("page.validationPasswordTooShort"));
      setLoading(false);
      return;
    }
    if (newPassword !== newPassword2) {
      showMessage(t("page.validationPasswordMismatch"));
      setLoading(false);
      return;
    }

    const optMail = normalizeSignupEmail(signupEmail);
    const payload: { password: string; email?: string; phone?: string } = { password: newPassword };
    if (optMail) {
      payload.email = optMail;
    }
    if (signupOtpChannel === "email" && phoneE164) {
      payload.phone = phoneE164;
    }

    const { error: ue } = await supabase.auth.updateUser({
      ...payload,
      data: { [SIGNUP_META_PASSWORD_PENDING]: false },
    });
    if (ue) {
      setMessage(ue.message);
      setLoading(false);
      return;
    }

    if (signupOtpChannel === "email" && phoneE164) {
      const link = await linkSignupPhoneOnAuth(phoneE164);
      if (!link.ok) {
        showMessage(link.error ?? t("page.validationPhoneLinkAfterSignup"));
        setLoading(false);
        return;
      }
    }

    const { data: userData, error: guErr } = await supabase.auth.getUser();
    if (guErr || !userData.user) {
      showMessage(guErr?.message ?? t("page.validationUserNotFoundAfterUpdate"));
      setLoading(false);
      return;
    }

    const fromMeta = signupProfileFromUser(userData.user);
    const resolvedName = fullName.trim() || fromMeta.full_name;
    const resolvedPhone = phoneE164 || fromMeta.whatsapp;

    const { error: pe } = await ensurePatientProfile(userData.user, {
      full_name: resolvedName,
      whatsapp: resolvedPhone,
      ...(optMail ? { email: optMail } : {}),
    });
    if (pe) {
      setMessage(pe.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    showMessage(t("page.successAccountCreated"), true);
    await redirectAfterAuth();
  };

  const resendSignupOtp = async () => {
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    const meta = {
      full_name: fullName.trim(),
      whatsapp: phoneE164,
      ...(signupOtpChannel === "email" ? { signup_phone: phoneE164 } : {}),
    };
    const { error } =
      signupOtpChannel === "email"
        ? await supabase.auth.signInWithOtp({
            email: signupEmailForOtp,
            options: {
              shouldCreateUser: false,
              data: { ...meta, [SIGNUP_META_PASSWORD_PENDING]: true },
            },
          })
        : await supabase.auth.signInWithOtp({
            phone: phoneE164,
            options: {
              channel: "sms",
              shouldCreateUser: false,
              data: { ...meta, [SIGNUP_META_PASSWORD_PENDING]: true },
            },
          });
    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }
    showMessage(signupOtpChannel === "email" ? t("signup.emailResent") : t("signup.smsResent"), true);
  };

  const resetForgotFlow = () => {
    setForgotResetStep("idle");
    setForgotPhoneE164("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotNewPassword2("");
  };

  const sendForgotPhoneOtp = async () => {
    const id = parseLoginIdentifier(loginId);
    if (!id || id.kind !== "phone") {
      showMessage(t("page.validationForgotNeedPhone"));
      return;
    }
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    const check = await checkPhoneRegisteredForPasswordReset(id.phone);
    if (!check.e164) {
      setLoading(false);
      showMessage(t("page.validationInvalidPhone"));
      return;
    }
    if (!check.registered) {
      setLoading(false);
      showMessage(t("reset.phoneNotFound"));
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      phone: check.e164,
      options: { channel: "sms", shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }
    setForgotPhoneE164(check.e164);
    setForgotResetStep("otp");
    showMessage(t("reset.smsSent"), true);
  };

  const resendForgotPhoneOtp = async () => {
    if (!forgotPhoneE164) return;
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    const { error } = await supabase.auth.signInWithOtp({
      phone: forgotPhoneE164,
      options: { channel: "sms", shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }
    showMessage(t("reset.smsResent"), true);
  };

  const verifyForgotPhoneOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    const code = forgotOtp.replace(/\D/g, "");
    if (code.length < 6) {
      showMessage(t("page.validationOtpTooShortSms"));
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.verifyOtp({
      phone: forgotPhoneE164,
      token: code,
      type: "sms",
    });
    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }
    setForgotResetStep("password");
    showMessage(t("reset.otpVerifiedPassword"), true);
  };

  const finishForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    if (forgotNewPassword.length < 6) {
      showMessage(t("page.validationPasswordTooShort"));
      setLoading(false);
      return;
    }
    if (forgotNewPassword !== forgotNewPassword2) {
      showMessage(t("page.validationPasswordMismatch"));
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: forgotNewPassword });
    setLoading(false);
    if (error) {
      showMessage(mapAuthErrorToLocale(error.message, t));
      return;
    }
    showMessage(t("reset.passwordDone"), true);
    resetForgotFlow();
    setForgotOpen(false);
    await redirectAfterAuth();
  };

  const sendPasswordReset = async () => {
    const id = parseLoginIdentifier(loginId);
    if (!id || id.kind !== "email") {
      showMessage(t("page.validationForgotNeedEmail"));
      return;
    }
    setLoading(true);
    setMessage("");
    setMessageSuccess(false);
    let res: Response;
    try {
      res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: id.email }),
      });
    } catch {
      setLoading(false);
      showMessage(t("page.validationResetRequestFailed"));
      return;
    }
    setLoading(false);
    if (!res.ok) {
      showMessage(t("page.validationResetRequestLater"));
      return;
    }
    showMessage(t("reset.emailSent"), true);
    setForgotOpen(false);
  };

  const isProvisionedPharmacistStep =
    isSignup && signupStep === "password" && searchParams.get("provisioned") === "1";

  const title = isProvisionedPharmacistStep
    ? "Première connexion officine"
    : isSignup
      ? signupStep === "form"
        ? t("page.titleSignup")
        : signupStep === "otp"
          ? signupOtpChannel === "email"
            ? t("page.titleSignupOtpEmail")
            : t("page.titleSignupOtpSms")
          : t("page.titleChoosePassword")
      : forgotResetStep === "otp"
        ? t("page.titleForgotOtp")
        : forgotResetStep === "password"
          ? t("page.titleForgotPassword")
          : t("page.titleLogin");

  const subtitle = isProvisionedPharmacistStep
    ? "Votre compte a été créé par l’administrateur. Choisissez un mot de passe personnel : vous vous connecterez ensuite avec votre numéro et ce mot de passe."
    : isSignup
      ? signupStep === "form"
        ? t("page.subtitleSignupForm")
        : signupStep === "otp"
          ? signupOtpChannel === "email"
            ? t("page.subtitleSignupOtpEmail")
            : t("page.subtitleSignupOtpSms")
          : t("page.subtitleSignupPassword")
      : forgotResetStep === "otp"
        ? t("page.subtitleForgotOtp")
        : forgotResetStep === "password"
          ? t("page.subtitleForgotPassword")
          : t("page.subtitleLogin");

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
        {tc("backToDirectory")}
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

        {!isSignup && forgotResetStep === "otp" ? (
          <form className="space-y-3" onSubmit={(ev) => void verifyForgotPhoneOtp(ev)}>
            <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              <p>
                {t("page.otpSentToPhone", { phone: forgotPhoneE164 })}
              </p>
              <p className="mt-1.5">{t("page.otpCheckSmsWhatsapp")}</p>
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("page.placeholderOtp")}
              className={fieldClass}
              value={forgotOtp}
              onChange={(e) => setForgotOtp(e.target.value)}
              maxLength={12}
              required
            />
            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc("wait")}
                </>
              ) : (
                t("page.buttonValidateOtp")
              )}
            </Button>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => void resendForgotPhoneOtp()}
              >
                {t("page.buttonResendSms")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => {
                  resetForgotFlow();
                  setForgotOpen(false);
                  setMessage("");
                  setMessageSuccess(false);
                }}
              >
                Retour connexion
              </Button>
            </div>
          </form>
        ) : !isSignup && forgotResetStep === "password" ? (
          <form className="space-y-3" onSubmit={(ev) => void finishForgotPassword(ev)}>
            <input
              type="password"
              placeholder={t("page.placeholderNewPassword")}
              className={fieldClass}
              value={forgotNewPassword}
              onChange={(e) => setForgotNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder={t("page.placeholderConfirmPassword")}
              className={fieldClass}
              value={forgotNewPassword2}
              onChange={(e) => setForgotNewPassword2(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <Button type="submit" disabled={loading} className="h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc("wait")}
                </>
              ) : (
                t("page.buttonSaveNewPassword")
              )}
            </Button>
          </form>
        ) : !isSignup ? (
          <form className="space-y-3" onSubmit={(ev) => void login(ev)}>
            <input
              type="text"
              placeholder={t("page.placeholderLoginId")}
              className={fieldClass}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
              autoComplete="username"
            />
            <input
              type="password"
              placeholder={t("page.placeholderPassword")}
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
                  resetForgotFlow();
                  setMessage("");
                  setMessageSuccess(false);
                }}
                className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
              >
                {t("page.buttonForgotPassword")}
              </button>
              {forgotOpen ? (
                <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">{t("page.forgotHint")}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void sendForgotPhoneOtp()}
                  >
                    {t("page.buttonReceiveSmsCode")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={loading}
                    onClick={() => void sendPasswordReset()}
                  >
                    {t("page.buttonSendEmailLink")}
                  </Button>
                </div>
              ) : null}
            </div>
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc("wait")}
                </>
              ) : (
                t("page.buttonLogin")
              )}
            </Button>
          </form>
        ) : signupStep === "form" ? (
          <form className="space-y-3" onSubmit={(ev) => void sendSignupSms(ev)}>
            <input
              type="text"
              placeholder={t("page.placeholderFullName")}
              className={fieldClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
            />
            <input
              type="tel"
              placeholder={t("page.placeholderPhone")}
              className={fieldClass}
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
              required
              autoComplete="tel"
            />
            <input
              type="email"
              placeholder={t("page.placeholderEmailOptional")}
              className={fieldClass}
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              autoComplete="email"
            />
            <Button type="submit" disabled={loading} className="mt-1 h-11 w-full gap-2 text-sm">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc("wait")}
                </>
              ) : (
                t("page.buttonReceiveVerificationCode")
              )}
            </Button>
          </form>
        ) : signupStep === "otp" ? (
          <form className="space-y-3" onSubmit={(ev) => void verifySignupOtp(ev)}>
            <div className="rounded-xl border border-border/80 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
              {signupOtpChannel === "email" ? (
                <>
                  <p>{t("page.otpSentToEmail", { email: signupEmailForOtp })}</p>
                  <p className="mt-1.5">{t("page.otpCheckEmailSpam")}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-foreground/80">
                    {t("page.otpAccountPhone", { phone: phoneE164 })}
                  </p>
                </>
              ) : (
                <>
                  <p>{t("page.otpSentToPhone", { phone: phoneE164 })}</p>
                  <p className="mt-1.5">{t("page.otpCheckSmsWhatsappOperator")}</p>
                </>
              )}
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder={t("page.placeholderOtp")}
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
                  {tc("wait")}
                </>
              ) : (
                t("page.buttonValidateOtp")
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
                {signupOtpChannel === "email" ? t("page.buttonResendEmail") : t("page.buttonResendSms")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={loading}
                onClick={() => resetSignupFlow()}
              >
                {t("page.buttonEditInfo")}
              </Button>
            </div>
          </form>
        ) : (
          <form className="space-y-3" onSubmit={(ev) => void finishSignup(ev)}>
            <input
              type="password"
              placeholder={t("page.placeholderSignupPassword")}
              className={fieldClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <input
              type="password"
              placeholder={t("page.placeholderConfirmPassword")}
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
                  {tc("wait")}
                </>
              ) : isProvisionedPharmacistStep ? (
                t("page.buttonSavePassword")
              ) : (
                t("page.buttonCreateAccount")
              )}
            </Button>
          </form>
        )}

        {!(isSignup && signupStep === "password" && searchParams.get("provisioned") === "1") ? (
        <button
          type="button"
          onClick={() => {
            setMessage("");
            setMessageSuccess(false);
            setForgotOpen(false);
            resetForgotFlow();
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
          {isSignup ? t("page.toggleHasAccount") : t("page.toggleNoAccount")}
        </button>
        ) : null}

        {message ? (
          <p
            className={cn(
              "mt-4 rounded-xl border px-3 py-2.5 text-sm leading-relaxed",
              messageSuccess
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

function AuthPageLoading() {
  const tc = useTranslations("common");
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 bg-background p-6 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      <span className="text-sm font-medium text-foreground">{tc("loading")}</span>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthFormGate />
    </Suspense>
  );
}
