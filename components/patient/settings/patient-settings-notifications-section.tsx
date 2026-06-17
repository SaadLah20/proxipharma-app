"use client";

import { useTranslations } from "next-intl";
import { ExternalNotificationPrefs } from "@/components/notifications/external-notification-prefs";
import { PatientSettingsSection } from "@/components/patient/patient-settings-section";

export function PatientSettingsNotificationsSection({ userId }: { userId: string }) {
  const t = useTranslations("account");

  return (
    <PatientSettingsSection title={t("externalAlerts")} subtitle={t("notificationsPrefsSubtitle")} defaultOpen={false}>
      <ExternalNotificationPrefs userId={userId} variant="patient" appearance="settings" />
    </PatientSettingsSection>
  );
}
