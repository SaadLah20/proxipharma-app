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
}: {
  userId: string | null;
  /** SMS réservé aux patients (répondu / traité). */
  variant?: "patient" | "pharmacien";
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

  return (
    <section className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/30 p-4">
      <h2 className="text-lg font-semibold text-amber-950">Alertes hors application (pilote)</h2>
      <p className="mt-1 text-xs text-amber-900/85">
        {showSms ? (
          <>
            En plus des notifications dans ProxiPharma, vous pouvez activer l&apos;envoi par e-mail (mêmes alertes que
            dans l&apos;app) ou par SMS pour deux cas seulement : réponse de la pharmacie sur votre demande, et demande
            marquée traitée — lorsque votre profil contient une adresse e-mail ou un numéro mobile (champ WhatsApp, format
            international).
          </>
        ) : (
          <>
            En plus des notifications dans ProxiPharma, vous pouvez activer l&apos;envoi par e-mail (mêmes alertes que
            dans l&apos;app) lorsque votre profil contient une adresse e-mail. Les SMS automatiques sont réservés aux
            patients.
          </>
        )}{" "}
        WhatsApp automatique arrive plus tard ; les liens manuels sur la fiche officine restent disponibles.
      </p>
      <div className="mt-4 space-y-2">
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.email_enabled}
            disabled={!loaded}
            onChange={(e) => setPrefs((p) => ({ ...p, email_enabled: e.target.checked }))}
          />
          <span>E-mail</span>
        </label>
        {showSms ? (
          <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={prefs.sms_enabled}
              disabled={!loaded}
              onChange={(e) => setPrefs((p) => ({ ...p, sms_enabled: e.target.checked }))}
            />
            <span>SMS</span>
          </label>
        ) : null}
        <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={prefs.whatsapp_enabled}
            disabled={!loaded}
            onChange={(e) => setPrefs((p) => ({ ...p, whatsapp_enabled: e.target.checked }))}
          />
          <span>WhatsApp</span>
        </label>
      </div>
      <button
        type="button"
        className="mt-4 rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-50"
        disabled={!loaded || saving}
        onClick={() => void save()}
      >
        {saving ? "Enregistrement…" : "Enregistrer les préférences"}
      </button>
      {msg ? <p className="mt-2 text-sm text-gray-800">{msg}</p> : null}
    </section>
  );
}
