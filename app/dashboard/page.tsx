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

type MyRequest = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  pharmacy_id: string;
  pharmacies: { nom: string; ville: string } | { nom: string; ville: string }[] | null;
};

type InAppNotification = {
  id: string;
  created_at: string;
  title: string;
  body: string | null;
  request_id: string;
  read_at: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [myPharmacy, setMyPharmacy] = useState<Pharmacy | null>(null);
  const [pharmaciesCount, setPharmaciesCount] = useState<number>(0);
  const [myRequests, setMyRequests] = useState<MyRequest[]>([]);
  const [requestsError, setRequestsError] = useState("");
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
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

        const { data: notifData } = await supabase
          .from("app_notifications")
          .select("id,created_at,title,body,request_id,read_at")
          .order("created_at", { ascending: false })
          .limit(8);
        if (Array.isArray(notifData)) {
          setNotifications(notifData as InAppNotification[]);
        }

        if (typedProfile.role === "admin") {
          const { count } = await supabase
            .from("pharmacies")
            .select("*", { count: "exact", head: true });
          setPharmaciesCount(count ?? 0);
        }

        if (typedProfile.role === "patient") {
          const { data: reqData, error: reqErr } = await supabase
            .from("requests")
            .select("id,created_at,status,request_type,pharmacy_id,pharmacies(nom,ville)")
            .eq("patient_id", user.id)
            .order("created_at", { ascending: false })
            .limit(25);

          if (reqErr) {
            setRequestsError(reqErr.message);
          } else if (Array.isArray(reqData)) {
            setMyRequests(reqData as unknown as MyRequest[]);
          }
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
        <section className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/80 to-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Mes demandes produits</h2>
          <p className="mt-1 text-sm text-slate-600">
            Suivi par statuts, filtres et détail des actions — même logique que les applis livraisons ou banque en ligne.
          </p>
          {requestsError ? (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{requestsError}</p>
          ) : (
            <p className="mt-4 text-sm font-medium text-slate-800">
              {myRequests.length === 0
                ? "Tu n’as pas encore de demande enregistrée."
                : `${myRequests.length} demande${myRequests.length > 1 ? "s" : ""} récente${myRequests.length > 1 ? "s" : ""} (aperçu).`}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/dashboard/demandes"
              className="inline-flex rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
            >
              Ouvrir Mes demandes
            </Link>
            <Link
              href="/"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Annuaire des pharmacies
            </Link>
          </div>
        </section>
      ) : null}

      {(profile?.role === "patient" || profile?.role === "pharmacien") && notifications.length > 0 ? (
        <section className="mt-4 rounded-xl border border-violet-200/70 bg-violet-50/40 p-4">
          <h2 className="text-lg font-semibold text-violet-950">Notifications</h2>
          <p className="mt-0.5 text-xs text-violet-900/80">Dernières mises à jour du workflow demandes.</p>
          <ul className="mt-3 space-y-2">
            {notifications.map((n) => (
              <li key={n.id} className="rounded-lg border border-violet-200/70 bg-white/90 px-3 py-2">
                <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-xs text-gray-700">{n.body}</p> : null}
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>{new Date(n.created_at).toLocaleString("fr-FR")}</span>
                  <Link
                    href={
                      profile?.role === "pharmacien"
                        ? `/dashboard/pharmacien/demandes/${n.request_id}`
                        : `/dashboard/demandes/${n.request_id}`
                    }
                    className="text-sky-700 underline"
                  >
                    Ouvrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
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
          {myPharmacy ? (
            <Link
              href="/dashboard/pharmacien/demandes"
              className="mt-4 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
            >
              Ouvrir les demandes pharmacie
            </Link>
          ) : null}
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
