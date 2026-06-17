"use client";

import { Bell, KeyRound, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { SettingsLocaleRow } from "@/components/settings/settings-locale-row";
import { SettingsNavLink } from "@/components/settings/settings-nav-link";

export function PatientSettingsQuickLinks() {
  const t = useTranslations("account");

  return (
    <section aria-labelledby="patient-settings-quick-access">
      <h2 id="patient-settings-quick-access" className="sr-only">
        {t("quickAccessTitle")}
      </h2>
      <ul className="space-y-2">
        <li>
          <SettingsNavLink
            href="/dashboard/notifications"
            label={t("inAppNotifications")}
            icon={Bell}
          />
        </li>
        <li>
          <SettingsNavLink
            href="/auth/update-password"
            label={t("changePassword")}
            icon={KeyRound}
          />
        </li>
        <li>
          <SettingsNavLink
            href="/dashboard/patient/pharmacies"
            label={t("pharmaciesTitle")}
            icon={MapPin}
          />
        </li>
        <li>
          <SettingsLocaleRow />
        </li>
      </ul>
    </section>
  );
}
