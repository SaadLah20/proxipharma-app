"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { ExternalNotificationPrefs } from "@/components/notifications/external-notification-prefs";
import { authEmailRedirectUrl, resolveClientAppBaseUrl } from "@/lib/auth-site-url";
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
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/patient/parametres");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;

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

    const p = profileData as Profile;
    setProfile(p);
    const authEm = u?.email?.trim() ?? "";
    const profileEm = p.email?.trim() ?? "";
    setRecoveryEmail((authEm || profileEm).trim());
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

  const saveRecoveryEmail = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile?.id) return;
    setRecoveryMessage("");
    const next = recoveryEmail.trim().toLowerCase();
    if (!next || !next.includes("@")) {
      setRecoveryMessage("Saisissez une adresse e-mail valide.");
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
      setRecoveryMessage("E-mail déjà associé à votre compte. Profil synchronisé.");
      return;
    }

    const { error: ue } = await supabase.auth.updateUser(
      { email: next },
      {
        emailRedirectTo: authEmailRedirectUrl(
          "/auth/callback?next=/dashboard/patient/parametres",
          resolveClientAppBaseUrl()
        ),
      }
    );
    if (ue) {
      setRecoverySaving(false);
      setRecoveryMessage(ue.message);
      return;
    }

    const { error: pe } = await supabase.from("profiles").update({ email: next }).eq("id", profile.id);
    setRecoverySaving(false);
    if (pe) {
      setRecoveryMessage(`E-mail mis à jour côté authentification. Erreur profil : ${pe.message}`);
      return;
    }

    setRecoveryMessage(
      "E-mail enregistré. Si votre projet Supabase exige la confirmation, ouvrez le lien reçu dans votre boîte pour finaliser."
    );
    void load();
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
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">E-mail (optionnel)</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Utile pour réinitialiser un mot de passe si vous utilisez aussi la connexion par e-mail, ou pour les
          notifications par mail. Les comptes créés uniquement par SMS peuvent l’ajouter plus tard.
        </p>
        <form className="mt-3 space-y-2" onSubmit={(ev) => void saveRecoveryEmail(ev)}>
          <input
            type="email"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            placeholder="vous@exemple.com"
            value={recoveryEmail}
            onChange={(e) => setRecoveryEmail(e.target.value)}
            autoComplete="email"
          />
          <button
            type="submit"
            disabled={recoverySaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {recoverySaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Enregistrement…
              </>
            ) : (
              "Enregistrer l’e-mail"
            )}
          </button>
        </form>
        {recoveryMessage ? (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{recoveryMessage}</p>
        ) : null}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Mot de passe : page <span className="font-mono text-foreground">/auth</span> → onglet E-mail → « Mot de passe
          oublié ? » (uniquement si vous avez un e-mail sur le compte).
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
