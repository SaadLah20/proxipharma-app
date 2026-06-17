"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import { PatientSettingsSection } from "@/components/patient/patient-settings-section";
import { InfoHint } from "@/components/ui/info-hint";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import type { PatientLoginMethods, PatientSettingsProfile } from "./use-patient-settings-data";

function ProfileField({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {hint}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PatientSettingsProfileSection({
  profile,
  loginMethods,
  onProfileUpdate,
}: {
  profile: PatientSettingsProfile;
  loginMethods: PatientLoginMethods;
  onProfileUpdate: (patch: Partial<PatientSettingsProfile>) => void;
}) {
  const t = useTranslations("account");
  const tc = useTranslations("common");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(profile.full_name?.trim() ?? "");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const phoneDisplay = profile.whatsapp?.trim() || loginMethods.authPhoneE164 || "—";
  const emailDisplay = profile.email?.trim() || loginMethods.authEmail || t("notProvided");

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const next = nameDraft.trim();
    if (!next) {
      setNameMessage(t("nameRequired"));
      return;
    }
    setNameSaving(true);
    setNameMessage("");
    const { error: pe } = await supabase.from("profiles").update({ full_name: next }).eq("id", profile.id);
    setNameSaving(false);
    if (pe) {
      setNameMessage(pe.message);
      return;
    }
    onProfileUpdate({ full_name: next });
    setEditingName(false);
    setNameMessage(t("nameSaved"));
    window.setTimeout(() => setNameMessage(""), 2500);
  };

  return (
    <PatientSettingsSection title={t("myProfile")} subtitle={t("profileSubtitle")} defaultOpen={false}>
      <dl className="space-y-3">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("name")}</dt>
          {editingName ? (
            <form className="mt-1.5 space-y-2" onSubmit={(ev) => void saveName(ev)}>
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                autoComplete="name"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={nameSaving}
                  className={clsx("px-3 py-1.5 text-xs font-semibold disabled:opacity-60", p.cta)}
                >
                  {nameSaving ? "…" : tc("save")}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                  onClick={() => {
                    setEditingName(false);
                    setNameDraft(profile.full_name?.trim() ?? "");
                    setNameMessage("");
                  }}
                >
                  {tc("cancel")}
                </button>
              </div>
            </form>
          ) : (
            <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-foreground">
              <span>{profile.full_name?.trim() || "—"}</span>
              <button type="button" className={p.linkInline} onClick={() => setEditingName(true)}>
                {tc("edit")}
              </button>
            </dd>
          )}
          {nameMessage ? <p className="mt-1 text-[11px] text-muted-foreground">{nameMessage}</p> : null}
        </div>

        <ProfileField
          label={t("phoneWhatsapp")}
          value={phoneDisplay}
          hint={<InfoHint label={t("phoneHint")}>{t("phoneHint")}</InfoHint>}
        />
        <ProfileField label={t("profileEmail")} value={emailDisplay} />
      </dl>
    </PatientSettingsSection>
  );
}
