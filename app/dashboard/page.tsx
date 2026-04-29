"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  full_name: string | null;
  whatsapp: string;
  email: string | null;
  role: "patient" | "pharmacien" | "admin";
};

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPharmacy, setMyPharmacy] = useState<Pharmacy | null>(null);
  const [pharmaciesCount, setPharmaciesCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;

      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setErrorMessage(profileError.message);
        setLoading(false);
        return;
      }

      if (profileData) {
        const typedProfile = profileData as Profile;
        setProfile(typedProfile);

        if (typedProfile.role === "admin") {
          const { count } = await supabase
            .from("pharmacies")
            .select("*", { count: "exact", head: true });
          setPharmaciesCount(count ?? 0);
        }

        if (typedProfile.role === "pharmacien") {
          const { data: staffLink, error: staffError } = await supabase
            .from("pharmacy_staff")
            .select("pharmacy_id")
            .eq("user_id", typedProfile.id)
            .limit(1)
            .maybeSingle();

          if (staffError) {
            setErrorMessage(staffError.message);
          }

          if (staffLink?.pharmacy_id) {
            const { data: pharmacyData, error: pharmacyError } = await supabase
              .from("pharmacies")
              .select("id,nom,ville,adresse,telephone")
              .eq("id", staffLink.pharmacy_id)
              .maybeSingle();

            if (pharmacyError) {
              setErrorMessage(pharmacyError.message);
            }

            if (pharmacyData) {
              setMyPharmacy(pharmacyData as Pharmacy);
            }
          }
        }
      }
      setLoading(false);
    };

    void load();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return <main className="min-h-screen p-6">Chargement...</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mon espace</h1>
        <button onClick={handleLogout} className="rounded-lg border px-3 py-2 text-sm">
          Deconnexion
        </button>
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Profil</h2>
        <p>
          <strong>Nom:</strong> {profile?.full_name || "Non renseigne"}
        </p>
        <p>
          <strong>WhatsApp:</strong> {profile?.whatsapp || "Non renseigne"}
        </p>
        <p>
          <strong>Email:</strong> {profile?.email || "Non renseigne"}
        </p>
        <p>
          <strong>Role:</strong> {profile?.role || "patient"}
        </p>
        {errorMessage ? (
          <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-700">
            Erreur chargement profil: {errorMessage}
          </p>
        ) : null}
      </section>

      {profile?.role === "patient" ? (
        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Espace patient</h2>
          <p className="text-sm text-gray-700">
            Tu peux maintenant naviguer l annuaire et preparer la suite (ordonnances, demandes produit,
            consultations) dans les prochains sprints.
          </p>
        </section>
      ) : null}

      {profile?.role === "pharmacien" ? (
        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Espace pharmacien</h2>
          {myPharmacy ? (
            <>
              <p>
                <strong>Pharmacie:</strong> {myPharmacy.nom}
              </p>
              <p>
                <strong>Ville:</strong> {myPharmacy.ville}
              </p>
              <p>
                <strong>Adresse:</strong> {myPharmacy.adresse}
              </p>
              <p>
                <strong>Telephone:</strong> {myPharmacy.telephone || "Non renseigne"}
              </p>
            </>
          ) : (
            <p className="text-sm text-amber-700">
              Aucun lien pharmacie trouve. Verifie `pharmacy_staff`.
            </p>
          )}
        </section>
      ) : null}

      {profile?.role === "admin" ? (
        <section className="mt-4 rounded-xl border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Espace administrateur</h2>
          <p>
            <strong>Pharmacies pilotes:</strong> {pharmaciesCount}
          </p>
          <p className="text-sm text-gray-700">
            Prochaine etape: ecran de gestion pharmacies/pharmaciens.
          </p>
          <Link href="/admin" className="mt-3 inline-block text-sm text-blue-700 underline">
            Ouvrir le panneau admin
          </Link>
        </section>
      ) : null}

      <Link href="/" className="mt-6 inline-block text-sm text-blue-700 underline">
        Retour a l annuaire
      </Link>
    </main>
  );
}
