"use client";

import { useCallback, useEffect, useState } from "react";
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
  /** SMS réservé aux patients (répondu / traité). */
  variant?: "patient" | "pharmacien";
  /** `settings` : intégré dans la page paramètres patient (style sobre). */
  appearance?: "default" | "settings";
}) {
  const showSms = variant === "patient";
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      return;
    }
    const { data, error } = await supabase
      .from("notification_external_prefs")
      .select("email_enabled,sms_enabled,whatsapp_enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      const row = data as Prefs;
      setPrefs(showSms ? row : { ...row, sms_enabled: false });
    }
    setLoaded(true);
  }, [userId, showSms]);

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
    const { error } = await supabase.from("notification_external_prefs").upsert(
      {
        user_id: userId,
        email_enabled: prefs.email_enabled,
        sms_enabled: showSms ? prefs.sms_enabled : false,
        whatsapp_enabled: prefs.whatsapp_enabled,
      },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg("Préférences enregistrées.");
  };

  if (!userId) {
    return null;
  }

  const isSettings = appearance === "settings";
  const showWhatsApp = !(isSettings && showSms);

  const body = (
    <>
      {!isSettings ? (
        <h2 className="text-lg font-semibold text-amber-950">Alertes hors application (pilote)</h2>
      ) : null}
      <p className={isSettings ? "text-[11px] leading-relaxed text-muted-foreground" : "mt-1 text-xs text-amber-900/85"}>
        {showSms ? (
          <>
            {isSettings
              ? "Mêmes alertes que dans l’app : e-mail si votre profil a une adresse, SMS si votre numéro est renseigné (réponse pharmacie ou dossier traité)."
              : "En plus des notifications dans ProxiPharma, vous pouvez activer l'envoi par e-mail (mêmes alertes que dans l'app) ou par SMS pour deux cas seulement : réponse de la pharmacie sur votre demande, et demande marquée traitée — lorsque votre profil contient une adresse e-mail ou un numéro mobile (champ WhatsApp, format international)."}
          </>
        ) : (
          <>
            En plus des notifications dans ProxiPharma, vous pouvez activer l&apos;envoi par e-mail (mêmes alertes que
            dans l&apos;app) lorsque votre profil contient une adresse e-mail. Les SMS automatiques sont réservés aux
            patients.
          </>
        )}
        {!isSettings ? (
          <> WhatsApp automatique arrive plus tard ; les liens manuels sur la fiche officine restent disponibles.</>
        ) : null}
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
          <span>E-mail</span>
        </label>
        {showSms ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-input"
              checked={prefs.sms_enabled}
              disabled={!loaded}
              onChange={(e) => setPrefs((p) => ({ ...p, sms_enabled: e.target.checked }))}
            />
            <span>SMS</span>
          </label>
        ) : null}
        {showWhatsApp ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-input"
              checked={prefs.whatsapp_enabled}
              disabled={!loaded}
              onChange={(e) => setPrefs((p) => ({ ...p, whatsapp_enabled: e.target.checked }))}
            />
            <span>WhatsApp</span>
          </label>
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
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
      {msg ? <p className="mt-2 text-xs text-muted-foreground">{msg}</p> : null}
    </>
  );

  if (isSettings) {
    return <div>{body}</div>;
  }

  return <section className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/30 p-4">{body}</section>;
}
