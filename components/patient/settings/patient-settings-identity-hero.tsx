"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { profileInitials } from "@/lib/profile-display";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import type { PatientSettingsProfile } from "./use-patient-settings-data";

export function PatientSettingsIdentityHero({
  profile,
  displayName,
}: {
  profile: PatientSettingsProfile | null;
  displayName: string;
}) {
  const t = useTranslations("account");
  const [copyRefMsg, setCopyRefMsg] = useState("");

  const copyPatientRef = async () => {
    const ref = profile?.patient_ref?.trim();
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setCopyRefMsg(t("refCopied"));
      window.setTimeout(() => setCopyRefMsg(""), 2500);
    } catch {
      setCopyRefMsg(t("copyFailed"));
    }
  };

  return (
    <div className="space-y-3">
      <Link href="/" className={clsx(p.backLink, "shrink-0 self-start")}>
        {t("backToDirectory")}
      </Link>

      <header className={p.hero}>
        <div className="flex items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary"
            aria-hidden
          >
            {profileInitials(profile?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className={p.heroEyebrow}>{t("patientAccount")}</p>
            <h1 className={clsx(p.heroTitle, "text-lg leading-snug sm:text-xl")}>{t("settingsTitle")}</h1>
            <p className={clsx("mt-0.5 truncate text-sm font-medium text-foreground")}>{displayName}</p>
            {profile?.patient_ref?.trim() ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={clsx("text-sm", p.monoAccent)}>{profile.patient_ref.trim()}</span>
                <button
                  type="button"
                  onClick={() => void copyPatientRef()}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-semibold text-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Copy className="size-3" aria-hidden />
                  {t("copy")}
                </button>
              </div>
            ) : null}
            {copyRefMsg ? <p className="mt-1 text-[11px] text-muted-foreground">{copyRefMsg}</p> : null}
          </div>
        </div>
        <p className={clsx("mt-3 leading-relaxed", p.heroSubtitle)}>{t("settingsSubtitle")}</p>
      </header>
    </div>
  );
}
