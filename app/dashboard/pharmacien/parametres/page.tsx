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
};

export default function PharmacienParametresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/parametres");
      return;
    }

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

    setProfile(profileData as Profile);

    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (staff?.pharmacy_id) {
      const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
      setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim());
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

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-6">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Paramètres généraux</h1>
        <p className="text-xs text-muted-foreground">Compte pharmacien et notifications.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {pharmacyNom ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm">
          Officine : <strong>{pharmacyNom}</strong>
        </p>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Profil</h2>
        <dl className="mt-3 space-y-2 text-sm">
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
