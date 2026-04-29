"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
};

type Assignment = {
  id: string;
  pharmacy_id: string;
  user_id: string;
  is_owner: boolean;
  created_at: string;
  pharmacy_name?: string;
  pharmacist_name?: string;
  pharmacist_email?: string;
};

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  const [nom, setNom] = useState("");
  const [adresse, setAdresse] = useState("");
  const [ville, setVille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [statut, setStatut] = useState("ouverte");

  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [pharmacienUserId, setPharmacienUserId] = useState("");
  const [isOwner, setIsOwner] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: pharmaciesData }, { data: assignmentsData }] = await Promise.all([
      supabase.from("pharmacies").select("id,nom,ville").order("created_at", { ascending: false }),
      supabase.from("pharmacy_staff").select("*").order("created_at", { ascending: false }),
    ]);

    if (pharmaciesData) {
      setPharmacies(pharmaciesData as Pharmacy[]);
      setSelectedPharmacyId((current) => current || pharmaciesData[0]?.id || "");
    }

    if (assignmentsData) {
      const staffRows = assignmentsData as Assignment[];
      const pharmacyMap = new Map((pharmaciesData as Pharmacy[] | null)?.map((p) => [p.id, p.nom]) ?? []);
      const userIds = [...new Set(staffRows.map((row) => row.user_id))];

      let profileMap = new Map<string, { full_name: string | null; email: string | null }>();

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);

        profileMap = new Map(
          (profilesData ?? []).map((p) => [
            p.id as string,
            { full_name: (p.full_name as string | null) ?? null, email: (p.email as string | null) ?? null },
          ])
        );
      }

      const enriched = staffRows.map((row) => {
        const pharmacist = profileMap.get(row.user_id);
        return {
          ...row,
          pharmacy_name: pharmacyMap.get(row.pharmacy_id) ?? "Pharmacie inconnue",
          pharmacist_name: pharmacist?.full_name ?? undefined,
          pharmacist_email: pharmacist?.email ?? undefined,
        };
      });

      setAssignments(enriched);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.replace("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setIsAdmin(true);
      await loadData();
      setLoading(false);
    };

    void init();
  }, [router, loadData]);

  const handleCreatePharmacy = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    const parsedLatitude = latitude ? Number(latitude) : null;
    const parsedLongitude = longitude ? Number(longitude) : null;

    if (latitude && Number.isNaN(parsedLatitude)) {
      setMessage("Latitude invalide. Utilise un nombre (ex: 33.5731).");
      return;
    }

    if (longitude && Number.isNaN(parsedLongitude)) {
      setMessage("Longitude invalide. Utilise un nombre (ex: -7.5898).");
      return;
    }

    if (parsedLatitude !== null && (parsedLatitude < -90 || parsedLatitude > 90)) {
      setMessage("Latitude hors limites (-90 a 90).");
      return;
    }

    if (parsedLongitude !== null && (parsedLongitude < -180 || parsedLongitude > 180)) {
      setMessage("Longitude hors limites (-180 a 180).");
      return;
    }

    const { error } = await supabase.from("pharmacies").insert({
      nom,
      adresse,
      ville,
      telephone,
      whatsapp,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      statut,
    });

    if (error) {
      setMessage(`Erreur creation pharmacie: ${error.message}`);
      return;
    }

    setNom("");
    setAdresse("");
    setVille("");
    setTelephone("");
    setWhatsapp("");
    setLatitude("");
    setLongitude("");
    setStatut("ouverte");
    setMessage("Pharmacie creee avec succes.");
    await loadData();
  };

  const handleAssignPharmacien = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    const { error } = await supabase.from("pharmacy_staff").upsert(
      {
        pharmacy_id: selectedPharmacyId,
        user_id: pharmacienUserId,
        is_owner: isOwner,
      },
      { onConflict: "pharmacy_id,user_id" }
    );

    if (error) {
      setMessage(`Erreur assignation: ${error.message}`);
      return;
    }

    setPharmacienUserId("");
    setMessage("Pharmacien assigne avec succes.");
    await loadData();
  };

  if (loading) {
    return <main className="min-h-screen p-6">Chargement...</main>;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panneau admin</h1>
        <Link href="/dashboard" className="text-sm text-blue-700 underline">
          Retour au dashboard
        </Link>
      </div>

      {message ? <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p> : null}

      <section className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Creer une pharmacie</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreatePharmacy}>
          <input
            className="rounded-lg border p-3"
            placeholder="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Ville"
            value={ville}
            onChange={(e) => setVille(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3 md:col-span-2"
            placeholder="Adresse"
            value={adresse}
            onChange={(e) => setAdresse(e.target.value)}
            required
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Telephone"
            value={telephone}
            onChange={(e) => setTelephone(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            placeholder="WhatsApp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Latitude (ex: 33.5731)"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <input
            className="rounded-lg border p-3"
            placeholder="Longitude (ex: -7.5898)"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
          <select
            className="rounded-lg border p-3 md:col-span-2"
            value={statut}
            onChange={(e) => setStatut(e.target.value)}
            required
          >
            <option value="ouverte">ouverte</option>
            <option value="fermee">fermee</option>
            <option value="garde">garde</option>
          </select>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
            Creer
          </button>
        </form>
      </section>

      <section className="mb-6 rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Assigner un pharmacien</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAssignPharmacien}>
          <select
            className="rounded-lg border p-3"
            value={selectedPharmacyId}
            onChange={(e) => setSelectedPharmacyId(e.target.value)}
            required
          >
            <option value="">Choisir une pharmacie</option>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.nom} ({pharmacy.ville})
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border p-3"
            placeholder="UUID user pharmacien"
            value={pharmacienUserId}
            onChange={(e) => setPharmacienUserId(e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.target.checked)} />
            Pharmacien proprietaire
          </label>
          <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white">
            Assigner
          </button>
        </form>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Assignations existantes</h2>
        <div className="space-y-2 text-sm">
          {assignments.length === 0 ? (
            <p className="text-gray-600">Aucune assignation pour le moment.</p>
          ) : (
            assignments.map((item) => (
              <p key={item.id} className="rounded bg-gray-50 p-2">
                Pharmacie: {item.pharmacy_name} | Pharmacien:{" "}
                {item.pharmacist_name || item.pharmacist_email || "Non renseigne"} | Owner:{" "}
                {item.is_owner ? "oui" : "non"} | UUID user: {item.user_id}
              </p>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
