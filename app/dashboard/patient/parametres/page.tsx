"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { ExternalNotificationPrefs } from "@/components/notifications/external-notification-prefs";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref?: string | null;
};

export default function PatientParametresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/patient/parametres");
      return;
    }

    const { data: profileData, error: pe } = await supabase
      .from("profiles")
      .select("id,full_name,whatsapp,email,role,patient_ref")
      .eq("id", user.id)
      .maybeSingle();

    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }

    if ((profileData as { role?: string } | null)?.role !== "patient") {
      router.replace("/");
      return;
    }

    setProfile(profileData as Profile);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-6">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Paramètres</h1>
        <p className="text-xs text-muted-foreground">Compte patient et notifications.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Profil</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {profile?.patient_ref?.trim() ? (
            <div>
              <dt className="text-xs text-muted-foreground">Votre code client</dt>
              <dd className="font-mono text-base font-semibold text-foreground">{profile.patient_ref.trim()}</dd>
              <p className="mt-1 text-[11px] text-muted-foreground">
                À communiquer à la pharmacie pour qu’elle retrouve votre dossier plus vite.
              </p>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted-foreground">Nom</dt>
            <dd className="text-foreground">{profile?.full_name?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">E-mail</dt>
            <dd className="text-foreground">{profile?.email?.trim() || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">WhatsApp</dt>
            <dd className="text-foreground">{profile?.whatsapp?.trim() || "—"}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Pour modifier l’e-mail ou le mot de passe, utilisez les outils prévus côté authentification (évolution prévue).
        </p>
      </section>

      {profile?.id ? <ExternalNotificationPrefs userId={profile.id} /> : null}

      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
      >
        Déconnexion
      </button>
    </PageShell>
  );
}
