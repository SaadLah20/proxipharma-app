"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  AlertTriangle,
  Bell,
  Building2,
  ChevronRight,
  Clock,
  Flag,
  KeyRound,
  Loader2,
  LogOut,
  MapPin,
  Package,
  Percent,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { ExternalNotificationPrefs } from "@/components/notifications/external-notification-prefs";
import { SettingsNavLink } from "@/components/settings/settings-nav-link";
import { PharmacistSettingsSection } from "@/components/pharmacist/pharmacist-settings-section";
import { profileInitials } from "@/lib/profile-display";
import { authEmailRedirectUrl, resolveClientAppBaseUrl } from "@/lib/auth-site-url";
import {
  patientLoginIdentifiersListFr,
  patientLoginMethodsFromAuthAndProfile,
  patientLoginMethodsSummaryFr,
} from "@/lib/patient-auth-login-methods-fr";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { userIsProvisionedPharmacist } from "@/lib/provisioned-pharmacist-auth";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
};

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function PharmacistSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [error, setError] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/parametres");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const u = userData.user;
    setAuthUser(u ?? null);

    const { data: profileData, error: pe } = await supabase
      .from("profiles")
      .select("id,full_name,whatsapp,email,role")
      .eq("id", user.id)
      .maybeSingle();

    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }

    if ((profileData as { role?: string } | null)?.role !== "pharmacien") {
      router.replace("/dashboard/pharmacien");
      return;
    }

    const prof = profileData as Profile;
    setProfile(prof);
    setNameDraft(prof.full_name?.trim() ?? "");
    const authEm = u?.email?.trim() ?? "";
    const profileEm = prof.email?.trim() ?? "";
    setRecoveryEmail((authEm || profileEm).trim());

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (staff?.pharmacy_id) {
      setPharmacyId(staff.pharmacy_id);
      const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
      setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim());
    } else {
      setPharmacyId(null);
      setPharmacyNom("");
    }

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
    setProfile((prev) => (prev ? { ...prev, full_name: next } : prev));
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
          "/auth/callback?next=/dashboard/pharmacien/parametres",
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

  const loginMethods = useMemo(
    () => patientLoginMethodsFromAuthAndProfile(authUser, profile?.whatsapp),
    [authUser, profile?.whatsapp]
  );
  const loginIdentifierLines = useMemo(() => patientLoginIdentifiersListFr(loginMethods), [loginMethods]);
  const provisioned = userIsProvisionedPharmacist(authUser);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-lg">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  const displayName = profile?.full_name?.trim() || "Mon compte";

  return (
    <PageShell maxWidthClass="max-w-lg" className={clsx("space-y-4 pb-8", p.page)}>
      <div>
        <Link href="/dashboard/pharmacien" className={p.backLink}>
          ← Tableau de bord
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
            <p className={p.heroEyebrow}>Compte pharmacien</p>
            <h1 className={clsx("truncate", p.heroTitle)}>Mes paramètres</h1>
            <p className={clsx("truncate text-sm font-medium", p.heroSubtitle)}>{displayName}</p>
            {pharmacyNom ? (
              <p className={clsx("mt-0.5 truncate text-xs", p.heroSubtitle)}>{pharmacyNom}</p>
            ) : null}
          </div>
        </div>
        <p className={clsx("mt-3 leading-relaxed", p.heroSubtitle)}>
          Profil, connexion, notifications et raccourcis officine — les dossiers restent dans le menu principal.
        </p>
      </header>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <PharmacistSettingsSection
        title="Mon profil"
        subtitle="Identité affichée dans l’espace pharmacien"
        defaultOpen
      >
        <dl className="space-y-3">
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
                <button type="button" className={p.linkInline} onClick={() => setEditingName(true)}>
                  Modifier
                </button>
              </dd>
            )}
            {nameMessage ? <p className="mt-1 text-[11px] text-muted-foreground">{nameMessage}</p> : null}
          </div>
          <ProfileField label="WhatsApp / contact officine" value={profile?.whatsapp?.trim() || "—"} />
          <p className="text-[11px] text-muted-foreground">
            Pour modifier le numéro de contact affiché aux patients, utilisez{" "}
            <Link href="/dashboard/pharmacien/ma-fiche" className={p.linkInline}>
              Ma fiche publique
            </Link>{" "}
            (onglet Coordonnées) ou contactez le support pilote.
          </p>
          <ProfileField
            label="E-mail sur le profil"
            value={profile?.email?.trim() || loginMethods.authEmail || "Non renseigné"}
          />
        </dl>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection
        title="Mon officine"
        subtitle="Fiche publique, horaires et visibilité"
        defaultOpen
      >
        <div className="space-y-3">
          {pharmacyNom ? (
            <p className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-sm text-foreground">
              Officine rattachée : <strong>{pharmacyNom}</strong>
            </p>
          ) : (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
              Aucune pharmacie liée à ce compte. Contactez l’administrateur pilote.
            </p>
          )}
          <ul className="space-y-2">
            <SettingsNavLink href="/dashboard/pharmacien/ma-fiche" label="Ma fiche publique" hint="Texte, photos, liens" icon={Store} />
            <SettingsNavLink
              href="/dashboard/pharmacien/horaires-garde"
              label="Horaires et garde"
              hint="Planning affiché sur la fiche"
              icon={Clock}
            />
            <SettingsNavLink
              href="/dashboard/pharmacien/pricing"
              label="Moteur de pricing"
              hint="Marges parapharmacie et visibilité des prix patient"
              icon={Percent}
            />
            {pharmacyId ? (
              <SettingsNavLink
                href={`/pharmacie/${pharmacyId}`}
                label="Voir la fiche comme un patient"
                hint="Aperçu public"
                icon={MapPin}
              />
            ) : null}
          </ul>
        </div>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection
        title="Produits"
        subtitle="Catalogue officine, commandes et ruptures"
        defaultOpen={false}
      >
        <ul className="space-y-2">
          <SettingsNavLink
            href="/dashboard/pharmacien/produits-commandes"
            label="Produits commandés"
            hint="Réceptions en attente"
            icon={ShoppingBag}
          />
          <SettingsNavLink
            href="/dashboard/pharmacien/ruptures-marche"
            label="Produits en rupture"
            hint="Ruptures catalogue national"
            icon={AlertTriangle}
          />
          <SettingsNavLink href="/dashboard/pharmacien/mes-produits" label="Mes produits" hint="Catalogue privé officine" icon={Package} />
          <SettingsNavLink
            href="/dashboard/pharmacien/produits-signales"
            label="Produits signalés"
            hint="Signalements catalogue Pharmeto"
            icon={Flag}
          />
        </ul>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection title="Packs promo" subtitle="Offres et réservations" defaultOpen={false}>
        <ul className="space-y-2">
          <SettingsNavLink
            href="/dashboard/pharmacien/offres-promos"
            label="Offres promo"
            hint="Packs publiés sur la fiche"
            icon={Sparkles}
          />
          <SettingsNavLink
            href="/dashboard/pharmacien/reservations-packs"
            label="Réservations"
            hint="Demandes patients sur vos packs"
            icon={Clock}
          />
        </ul>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection title="Connexion et sécurité" subtitle="Identifiants et mot de passe" defaultOpen>
        <div className="space-y-4">
          {provisioned ? (
            <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-[11px] leading-relaxed text-amber-950">
              Compte créé par l’administrateur : si vous n’avez pas encore choisi votre mot de passe, utilisez le lien
              reçu à la première connexion ou « Mot de passe oublié » sur la page de connexion.
            </p>
          ) : null}
          <div className="rounded-lg border border-border/80 bg-muted/25 px-3 py-2.5">
            <p className="text-xs font-semibold text-foreground">Comment vous connecter</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {patientLoginMethodsSummaryFr(loginMethods)}
            </p>
            {loginIdentifierLines.length > 0 ? (
              <ul className="mt-2 space-y-0.5 text-[11px] text-foreground">
                {loginIdentifierLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div>
            <Link
              href="/auth/update-password"
              className={clsx("inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold shadow-sm", p.cta)}
            >
              <KeyRound className="size-4" aria-hidden />
              Changer mon mot de passe
            </Link>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Mot de passe oublié : déconnectez-vous puis « Mot de passe oublié » sur la page de connexion (e-mail).
            </p>
          </div>
          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">E-mail de connexion / récupération</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Utilisé pour vous connecter et réinitialiser votre mot de passe.
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
      </PharmacistSettingsSection>

      <PharmacistSettingsSection
        title="Notifications"
        subtitle="Dans l’application et par e-mail"
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
            <p className="mt-1 text-[11px] text-muted-foreground">
              E-mail et WhatsApp selon vos préférences (pas de SMS alertes dossier).
            </p>
            {profile?.id ? (
              <ExternalNotificationPrefs userId={profile.id} variant="pharmacien" appearance="settings" />
            ) : null}
          </div>
        </div>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection title="Raccourcis" subtitle="Hubs principaux (détail dans le menu compte)" defaultOpen={false}>
        <ul className="space-y-2 text-sm">
          <li>
            <Link href="/dashboard/pharmacien" className={p.linkInline}>
              Tableau de bord
            </Link>
          </li>
          <li>
            <Link href="/dashboard/pharmacien/demandes" className={p.linkInline}>
              Toutes les demandes
            </Link>
          </li>
          <li>
            <Link href="/dashboard/pharmacien/clients" className={p.linkInline}>
              Clients
            </Link>
          </li>
          <li>
            <Link href="/" className={clsx("inline-flex items-center gap-1.5", p.linkInline)}>
              <MapPin className="size-3.5" aria-hidden />
              Annuaire interactif
            </Link>
          </li>
        </ul>
      </PharmacistSettingsSection>

      <PharmacistSettingsSection title="Compte et session" subtitle="Déconnexion" defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-foreground">Déconnexion</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Quitter Pharmeto sur cet appareil. Vos dossiers et la fiche officine ne sont pas supprimés.
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
          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-semibold text-foreground">Suppression du compte</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Au pilote, la fermeture d’un compte pharmacien est gérée par l’administrateur (données officine
              conservées). Contactez le support si vous devez être détaché de l’officine.
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Building2 className="size-3.5 shrink-0" aria-hidden />
              Officine : {pharmacyNom || "non rattachée"}
            </p>
          </div>
        </div>
      </PharmacistSettingsSection>
    </PageShell>
  );
}
