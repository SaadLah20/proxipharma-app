"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

type Prefs = {
  email_enabled: boolean;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
};

const defaultPrefs: Prefs = {
  email_enabled: false,
  sms_enabled: false,
  whatsapp_enabled: false,
};

export function ExternalNotificationPrefs({
  userId,
  variant = "patient",
  appearance = "default",
}: {
  userId: string | null;
  /** Préférences alertes hors-app (e-mail, WhatsApp). SMS métier désactivé — OTP auth inchangé. */
  variant?: "patient" | "pharmacien";
  /** `settings` : intégré dans la page paramètres patient (style sobre). */
  appearance?: "default" | "settings";
}) {
  const t = useTranslations("account.notificationPrefs");
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }
    const [prefsRes, profileRes] = await Promise.all([
      supabase
        .from("notification_external_prefs")
        .select("email_enabled,sms_enabled,whatsapp_enabled")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.from("profiles").select("whatsapp").eq("id", userId).maybeSingle(),
    ]);

    if (!prefsRes.error && prefsRes.data) {
      const row = prefsRes.data as Prefs;
      setPrefs({ ...row, sms_enabled: false });
    }
    const wa = (profileRes.data as { whatsapp?: string | null } | null)?.whatsapp?.trim();
    setContactPhone(wa || null);
    setLoaded(true);
  }, [userId]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const save = async () => {
    if (!userId) {
      return;
    }
    setSaving(true);
    setMsg(null);
    const whatsappEnabled = contactPhone ? prefs.whatsapp_enabled : false;
    const { error } = await supabase.from("notification_external_prefs").upsert(
      {
        user_id: userId,
        email_enabled: prefs.email_enabled,
        sms_enabled: false,
        whatsapp_enabled: whatsappEnabled,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(t("saved"));
  };

  if (!userId) {
    return null;
  }

  const isSettings = appearance === "settings";
  const showWhatsApp = true;

  const body = (
    <>
      {!isSettings ? (
        <h2 className="text-lg font-semibold text-amber-950">{t("titleDefault")}</h2>
      ) : null}
      <p className={isSettings ? "text-[11px] leading-relaxed text-muted-foreground" : "mt-1 text-xs text-amber-900/85"}>
        {variant === "patient"
          ? isSettings
            ? t("introPatientSettings")
            : t("introPatientDefault")
          : t("introPharmacist")}
      </p>
      <div className={isSettings ? "mt-3 space-y-2" : "mt-4 space-y-2"}>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-input"
            checked={prefs.email_enabled}
            disabled={!loaded}
            onChange={(e) => setPrefs((p) => ({ ...p, email_enabled: e.target.checked }))}
          />
          <span>{t("email")}</span>
        </label>
        {showWhatsApp ? (
          <div className="space-y-1">
            <label
              className={`flex items-start gap-2 text-sm text-foreground ${contactPhone ? "cursor-pointer" : ""}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 rounded border-input"
                checked={contactPhone ? prefs.whatsapp_enabled : false}
                disabled={!loaded || !contactPhone}
                onChange={(e) => setPrefs((p) => ({ ...p, whatsapp_enabled: e.target.checked }))}
              />
              <span>
                {contactPhone ? t("whatsappOnNumber", { phone: contactPhone }) : t("whatsapp")}
              </span>
            </label>
            {contactPhone ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("whatsappHint")}</p>
            ) : (
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("whatsappNoPhone")}</p>
            )}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={
          isSettings
            ? "mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-50"
            : "mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
        }
        disabled={!loaded || saving}
        onClick={() => void save()}
      >
        {saving ? t("saving") : t("save")}
      </button>
      {msg ? <p className="mt-2 text-xs text-muted-foreground">{msg}</p> : null}
    </>
  );

  if (isSettings) {
    return <div>{body}</div>;
  }

  return <section className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/30 p-4">{body}</section>;
}
