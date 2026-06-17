"use client";

import { FormEvent, useMemo, useState } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { PatientSettingsSection } from "@/components/patient/patient-settings-section";
import { InfoHint } from "@/components/ui/info-hint";
import { linkMyPhoneOnAuth } from "@/lib/auth-client-phone-link";
import { authEmailRedirectUrl, resolveClientAppBaseUrl } from "@/lib/auth-site-url";
import { usePatientLoginMethodsCopy } from "@/lib/i18n/use-patient-login-methods-copy";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import type { PatientLoginMethods, PatientSettingsProfile } from "./use-patient-settings-data";

export function PatientSettingsSecuritySection({
  profile,
  loginMethods,
  recoveryEmail,
  onRecoveryEmailChange,
  onReload,
  onAuthRefresh,
}: {
  profile: PatientSettingsProfile;
  loginMethods: PatientLoginMethods;
  recoveryEmail: string;
  onRecoveryEmailChange: (value: string) => void;
  onReload: () => void;
  onAuthRefresh: () => void;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const { summary: loginMethodsSummary, identifiers: loginMethodsIdentifiers } = usePatientLoginMethodsCopy();
  const [phoneLinkLoading, setPhoneLinkLoading] = useState(false);
  const [phoneLinkMessage, setPhoneLinkMessage] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const loginIdentifierLines = useMemo(
    () => loginMethodsIdentifiers(loginMethods),
    [loginMethods, loginMethodsIdentifiers],
  );

  const isSimpleAccount =
    (loginMethods.canLoginWithEmail || loginMethods.canLoginWithPhone) && !loginMethods.needsPhoneAuthSync;
  const showLoginMethodsInfo = !isSimpleAccount;

  const activatePhoneLogin = async () => {
    setPhoneLinkMessage("");
    setPhoneLinkLoading(true);
    const result = await linkMyPhoneOnAuth();
    setPhoneLinkLoading(false);
    if (!result.ok) {
      setPhoneLinkMessage(result.error ?? t("phoneLinkFailed"));
      return;
    }
    setPhoneLinkMessage(
      result.phone ? t("phoneLinkSuccess", { phone: result.phone }) : t("phoneLinkAlreadyActive"),
    );
    onAuthRefresh();
  };

  const saveRecoveryEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setRecoveryMessage("");
    const next = recoveryEmail.trim().toLowerCase();
    if (!next || !next.includes("@")) {
      setRecoveryMessage(t("emailInvalid"));
      return;
    }
    setRecoverySaving(true);
    const { data: before } = await supabase.auth.getUser();
    const prev = before.user?.email?.trim().toLowerCase() ?? "";
    if (prev === next) {
      const { error: pe } = await supabase.from("profiles").update({ email: next }).eq("id", profile.id);
      setRecoverySaving(false);
      if (pe) {
        setRecoveryMessage(pe.message);
        return;
      }
      setRecoveryMessage(t("emailSavedProfile"));
      onReload();
      return;
    }

    const { error: ue } = await supabase.auth.updateUser(
      { email: next },
      {
        emailRedirectTo: authEmailRedirectUrl(
          "/auth/callback?next=/dashboard/patient/parametres",
          resolveClientAppBaseUrl(),
        ),
      },
    );
    if (ue) {
      setRecoverySaving(false);
      setRecoveryMessage(ue.message);
      return;
    }

    const { error: pe } = await supabase.from("profiles").update({ email: next }).eq("id", profile.id);
    setRecoverySaving(false);
    if (pe) {
      setRecoveryMessage(t("emailProfileError", { message: pe.message }));
      return;
    }

    setRecoveryMessage(t("emailSavedConfirm"));
    onReload();
  };

  return (
    <PatientSettingsSection
      title={t("loginSecurity")}
      subtitle={t("loginSecurityAdvancedSubtitle")}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {showLoginMethodsInfo ? (
          <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">{t("howYouLogin")}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {loginMethodsSummary(loginMethods)}
            </p>
            {loginIdentifierLines.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-foreground">
                {loginIdentifierLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {loginMethods.needsPhoneAuthSync ? (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] leading-snug text-amber-900">{t("phoneSyncHint")}</p>
                <button
                  type="button"
                  disabled={phoneLinkLoading}
                  onClick={() => void activatePhoneLogin()}
                  className={clsx(
                    "inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-60",
                    p.cta,
                  )}
                >
                  {phoneLinkLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      {t("activating")}
                    </>
                  ) : (
                    t("activatePhoneLogin")
                  )}
                </button>
                {phoneLinkMessage ? (
                  <p className="text-[11px] leading-snug text-muted-foreground">{phoneLinkMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className={clsx(showLoginMethodsInfo && "border-t border-border/60 pt-4")}>
          <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
            {loginMethods.canLoginWithEmail ? t("recoveryEmailLogin") : t("recoveryEmailOptional")}
            <InfoHint label={t("forgotPasswordHint")}>{t("forgotPasswordHint")}</InfoHint>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {loginMethods.canLoginWithEmail ? t("recoveryEmailLoginHint") : t("recoveryEmailOptionalHint")}
          </p>
          <form className="mt-3 space-y-2" onSubmit={(ev) => void saveRecoveryEmail(ev)}>
            <input
              type="email"
              className={clsx(
                "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2",
                p.searchInput,
              )}
              placeholder={t("emailPlaceholder")}
              value={recoveryEmail}
              onChange={(e) => onRecoveryEmailChange(e.target.value)}
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={recoverySaving}
              className={clsx(
                "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60",
                p.ctaOutline,
              )}
            >
              {recoverySaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tc("saving")}
                </>
              ) : (
                t("saveEmail")
              )}
            </button>
          </form>
          {recoveryMessage ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{recoveryMessage}</p>
          ) : null}
        </div>
      </div>
    </PatientSettingsSection>
  );
}
