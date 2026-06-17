"use client";

import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/compact-shell";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { PatientSettingsIdentityHero } from "./patient-settings-identity-hero";
import { PatientSettingsNotificationsSection } from "./patient-settings-notifications-section";
import { PatientSettingsProfileSection } from "./patient-settings-profile-section";
import { PatientSettingsQuickLinks } from "./patient-settings-quick-links";
import { PatientSettingsSecuritySection } from "./patient-settings-security-section";
import { PatientSettingsSessionSection } from "./patient-settings-session-section";
import { usePatientSettingsData } from "./use-patient-settings-data";

export function PatientSettingsPage() {
  const tc = useTranslations("common");
  const t = useTranslations("account");
  const {
    loading,
    profile,
    error,
    recoveryEmail,
    setRecoveryEmail,
    loginMethods,
    load,
    updateProfile,
    refreshAuthUser,
  } = usePatientSettingsData();

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-lg">
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </PageShell>
    );
  }

  const displayName = profile?.full_name?.trim() || t("defaultAccountName");

  return (
    <PageShell maxWidthClass="max-w-lg" className={clsx("space-y-4 pb-8", p.page)}>
      <PatientSettingsIdentityHero profile={profile} displayName={displayName} />

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <PatientSettingsQuickLinks />

      {profile ? (
        <>
          <PatientSettingsProfileSection
            profile={profile}
            loginMethods={loginMethods}
            onProfileUpdate={updateProfile}
          />
          <PatientSettingsNotificationsSection userId={profile.id} />
          <PatientSettingsSecuritySection
            profile={profile}
            loginMethods={loginMethods}
            recoveryEmail={recoveryEmail}
            onRecoveryEmailChange={setRecoveryEmail}
            onReload={() => void load()}
            onAuthRefresh={() => void refreshAuthUser()}
          />
        </>
      ) : null}

      <PatientSettingsSessionSection />
    </PageShell>
  );
}
