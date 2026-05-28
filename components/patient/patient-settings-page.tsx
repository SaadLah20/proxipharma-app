"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  Bell,
  ChevronRight,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
} from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { ExternalNotificationPrefs } from "@/components/notifications/external-notification-prefs";
import { PatientSettingsSection } from "@/components/patient/patient-settings-section";
import { authEmailRedirectUrl, resolveClientAppBaseUrl } from "@/lib/auth-site-url";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref?: string | null;
};

function profileInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const t = (name ?? "").trim();
  return t ? t.slice(0, 2).toUpperCase() : "?";
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PatientSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authPhone, setAuthPhone] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [copyRefMsg, setCopyRefMsg] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteAck, setDeleteAck] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
    setAuthPhone(u?.phone?.trim() || null);

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
    setNameDraft(p.full_name?.trim() ?? "");
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

  const deleteAccount = async () => {
    setDeleteError("");
    if (!deleteAck) {
      setDeleteError("Cochez la case de confirmation.");
      return;
    }
    if (deleteConfirm.trim().toUpperCase() !== "SUPPRIMER") {
      setDeleteError('Tapez exactement « SUPPRIMER » pour confirmer.');
      return;
    }
    setDeleteLoading(true);
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    if (!token) {
      setDeleteLoading(false);
      setDeleteError("Session expirée. Reconnectez-vous.");
      return;
    }
    try {
      const res = await fetch("/api/patient/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setDeleteError(body.error ?? "Suppression impossible.");
        setDeleteLoading(false);
        return;
      }
      await supabase.auth.signOut();
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Erreur réseau.");
      setDeleteLoading(false);
    }
  };

  const copyPatientRef = async () => {
    const ref = profile?.patient_ref?.trim();
    if (!ref) return;
    try {
      await navigator.clipboard.writeText(ref);
      setCopyRefMsg("Code copié.");
      window.setTimeout(() => setCopyRefMsg(""), 2500);
    } catch {
      setCopyRefMsg("Copie impossible sur cet appareil.");
    }
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    const next = nameDraft.trim();
    if (!next) {
      setNameMessage("Indiquez votre nom.");
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
    setProfile((p) => (p ? { ...p, full_name: next } : p));
    setEditingName(false);
    setNameMessage("Nom enregistré.");
    window.setTimeout(() => setNameMessage(""), 2500);
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
      setRecoveryMessage("E-mail enregistré sur votre profil.");
      void load();
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
      setRecoveryMessage(`E-mail mis à jour côté connexion. Erreur profil : ${pe.message}`);
      return;
    }

    setRecoveryMessage(
      "E-mail enregistré. Ouvrez le lien de confirmation reçu par mail si votre messagerie vous le demande."
    );
    void load();
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-lg">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  const displayName = profile?.full_name?.trim() || "Mon compte";
  const phoneDisplay = profile?.whatsapp?.trim() || authPhone || "—";

  return (
    <PageShell maxWidthClass="max-w-lg" className={clsx("space-y-4 pb-8", p.page)}>
      <div>
        <Link href="/" className={p.backLink}>
          ← Annuaire
        </Link>
      </div>

      <header className={p.hero}>
        <div className="flex items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-lg font-bold"
            aria-hidden
          >
            {profileInitials(profile?.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className={p.heroEyebrow}>Compte patient</p>
            <h1 className={clsx("truncate", p.heroTitle)}>Mes paramètres</h1>
            <p className={clsx("truncate text-sm font-medium", p.heroSubtitle)}>{displayName}</p>
            {profile?.patient_ref?.trim() ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-semibold">{profile.patient_ref.trim()}</span>
                <button
                  type="button"
                  onClick={() => void copyPatientRef()}
                  className="inline-flex items-center gap-1 rounded-md bg-primary-foreground/15 px-2 py-0.5 text-[11px] font-medium hover:bg-primary-foreground/25"
                >
                  <Copy className="size-3" aria-hidden />
                  Copier
                </button>
              </div>
            ) : null}
            {copyRefMsg ? <p className={clsx("mt-1 text-[11px]", p.heroSubtitle)}>{copyRefMsg}</p> : null}
          </div>
        </div>
        <p className={clsx("mt-3 leading-relaxed", p.heroSubtitle)}>
          Profil, connexion et notifications — vos dossiers restent dans le menu principal.
        </p>
      </header>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <PatientSettingsSection
        title="Mon profil"
        subtitle="Identité visible par les pharmacies avec lesquelles vous échangez"
        defaultOpen
      >
        <dl className="space-y-3">
          {profile?.patient_ref?.trim() ? (
            <div>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Code client
              </dt>
              <dd className={clsx("text-base", p.monoAccent)}>{profile.patient_ref.trim()}</dd>
              <p className="mt-1 text-[11px] text-muted-foreground">
                À donner à l’officine pour retrouver votre dossier plus vite.
              </p>
            </div>
          ) : null}

          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Nom</dt>
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
                    {nameSaving ? "…" : "Enregistrer"}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium"
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(profile?.full_name?.trim() ?? "");
                      setNameMessage("");
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            ) : (
              <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-foreground">
                <span>{profile?.full_name?.trim() || "—"}</span>
                <button
                  type="button"
                  className={p.linkInline}
                  onClick={() => setEditingName(true)}
                >
                  Modifier
                </button>
              </dd>
            )}
            {nameMessage ? <p className="mt-1 text-[11px] text-muted-foreground">{nameMessage}</p> : null}
          </div>

          <ProfileField label="Téléphone / WhatsApp" value={phoneDisplay} />
          <p className="text-[11px] text-muted-foreground">
            Identifiant de connexion : modification uniquement via le support pour le pilote.
          </p>
          <ProfileField label="E-mail sur le profil" value={profile?.email?.trim() || "Non renseigné"} />
        </dl>
      </PatientSettingsSection>

      <PatientSettingsSection
        title="Connexion et sécurité"
        subtitle="Mot de passe et e-mail de récupération"
        defaultOpen
      >
        <div className="space-y-4">
          <div>
            <Link
              href="/auth/update-password"
              className={clsx("inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold shadow-sm", p.cta)}
            >
              <KeyRound className="size-4" aria-hidden />
              Changer mon mot de passe
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Mot de passe oublié sans être connecté : déconnectez-vous puis utilisez « Mot de passe oublié » sur la
              page de connexion (SMS ou e-mail selon votre compte).
            </p>
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">E-mail de récupération (optionnel)</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Utile pour réinitialiser un mot de passe et recevoir certaines alertes par mail.
            </p>
            <form className="mt-3 space-y-2" onSubmit={(ev) => void saveRecoveryEmail(ev)}>
              <input
                type="email"
                className={clsx(
                  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2",
                  p.searchInput
                )}
                placeholder="vous@exemple.com"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={recoverySaving}
                className={clsx(
                  "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60",
                  p.ctaOutline
                )}
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
          </div>
        </div>
      </PatientSettingsSection>

      <PatientSettingsSection
        title="Notifications"
        subtitle="Dans l’application et par e-mail / SMS"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <Link
            href="/dashboard/notifications"
            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm font-medium text-foreground transition hover:bg-muted/40"
          >
            <span className="inline-flex items-center gap-2">
              <Bell className="size-4 text-primary" aria-hidden />
              Voir mes notifications in-app
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>

          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">Alertes hors application</p>
            {profile?.id ? (
              <ExternalNotificationPrefs userId={profile.id} variant="patient" appearance="settings" />
            ) : null}
          </div>
        </div>
      </PatientSettingsSection>

      <PatientSettingsSection title="Aide" subtitle="Parcourir et comprendre le pilote" defaultOpen={false}>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/" className={clsx("inline-flex items-center gap-1.5", p.linkInline)}>
              <MapPin className="size-3.5" aria-hidden />
              Annuaire des pharmacies
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/patient/pharmacies"
              className={clsx("inline-flex items-center gap-1.5", p.linkInline)}
            >
              Mes pharmacies
            </Link>
          </li>
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Envoyez une demande depuis la fiche d’une officine, suivez les réponses dans{" "}
          <strong className="font-medium text-foreground">Mes demandes</strong>, validez sous 24 h après la réponse
          pharmacie.
        </p>
      </PatientSettingsSection>

      <PatientSettingsSection
        title="Compte et session"
        subtitle="Déconnexion ou suppression définitive"
        defaultOpen={false}
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-foreground">Déconnexion</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Quitter ProxiPharma sur cet appareil sans supprimer vos données.
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/40"
            >
              <LogOut className="size-4" aria-hidden />
              Se déconnecter
            </button>
          </div>

          <div className="border-t border-destructive/20 pt-4">
            <p className="text-xs font-semibold text-destructive">Supprimer mon compte</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Action définitive : votre accès sera supprimé. Impossible s&apos;il reste un dossier ou une réservation
              promo en cours.
            </p>
            {!deleteOpen ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-2 text-sm font-semibold text-destructive underline underline-offset-2"
              >
                Je souhaite supprimer mon compte
              </button>
            ) : (
              <div className="mt-3 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
                  <input
                    type="checkbox"
                    checked={deleteAck}
                    onChange={(e) => setDeleteAck(e.target.checked)}
                    className="mt-0.5 rounded border-input"
                  />
                  <span>Je comprends que cette action est irréversible et que mes données de compte seront effacées.</span>
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Confirmation
                  <input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="SUPPRIMER"
                    className="mt-1 w-full rounded-lg border border-destructive/40 bg-background px-3 py-2 font-mono text-sm uppercase"
                    autoComplete="off"
                  />
                </label>
                {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={() => void deleteAccount()}
                    className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-95 disabled:opacity-60"
                  >
                    {deleteLoading ? "Suppression…" : "Supprimer définitivement"}
                  </button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeleteConfirm("");
                      setDeleteAck(false);
                      setDeleteError("");
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-sm font-medium"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </PatientSettingsSection>
    </PageShell>
  );
}
