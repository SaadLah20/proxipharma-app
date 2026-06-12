"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AdminPilotBlock } from "@/components/admin/AdminPilotBlock";
import { AdminOnboardPharmacyForm } from "@/components/admin/AdminOnboardPharmacyForm";
import {
  AdminPharmacyCoordsFields,
  validateAdminPharmacyCoordsForSubmit,
} from "@/components/admin/AdminPharmacyCoordsFields";
import { PharmacyCitySelect } from "@/components/pharmacy/pharmacy-city-select";
import { lookupPharmacyCity, validatePharmacyCityForSubmit } from "@/lib/pharmacy-cities-morocco";
import { parseAdminPharmacyCoords } from "@/lib/pharmacy-coords-morocco";
import { countPendingCommunityCatalogProducts } from "@/lib/admin-community-catalog-api";

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
  const [publicListed, setPublicListed] = useState(false);

  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [pharmacienUserId, setPharmacienUserId] = useState("");
  const [isOwner, setIsOwner] = useState(true);
  const [pendingCommunityProducts, setPendingCommunityProducts] = useState<number | null>(null);

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
        router.replace("/");
        return;
      }

      setIsAdmin(true);
      await loadData();
      try {
        const count = await countPendingCommunityCatalogProducts(supabase);
        setPendingCommunityProducts(count);
      } catch {
        setPendingCommunityProducts(null);
      }
      setLoading(false);
    };

    void init();
  }, [router, loadData]);

  const handleCreatePharmacy = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    const cityErr = validatePharmacyCityForSubmit(ville);
    if (cityErr) {
      setMessage(cityErr);
      return;
    }

    const coordsErr = validateAdminPharmacyCoordsForSubmit(latitude, longitude, true);
    if (coordsErr) {
      setMessage(coordsErr);
      return;
    }
    const coords = parseAdminPharmacyCoords(latitude, longitude, { required: true });
    if (!coords.ok || coords.latitude === null || coords.longitude === null) {
      setMessage(!coords.ok ? coords.error : "Coordonnées invalides.");
      return;
    }

    const villeCanon = lookupPharmacyCity(ville)?.fr ?? ville;

    const { error } = await supabase.from("pharmacies").insert({
      nom,
      adresse,
      ville: villeCanon,
      telephone,
      whatsapp,
      latitude: coords.latitude,
      longitude: coords.longitude,
      statut,
      public_listed: publicListed,
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
    setPublicListed(false);
    setMessage("Pharmacie créée. Horaires Maroc par défaut appliqués automatiquement (migration 20260606_001).");
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
        <Link href="/" className="text-sm text-blue-700 underline">
          Annuaire
        </Link>
      </div>

      {message ? <p className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p> : null}

      <section className="mb-6 rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Catalogue communautaire</h2>
            <p className="mt-1 text-sm text-gray-600">
              Produits créés par les officines, en attente de publication nationale.
            </p>
          </div>
          <Link
            href="/admin/produits-communautaires"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
          >
            Produits communautaires
            {pendingCommunityProducts != null ? (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {pendingCommunityProducts}
              </span>
            ) : null}
          </Link>
        </div>
      </section>

      <AdminOnboardPharmacyForm onCreated={loadData} />

      <AdminPilotBlock pharmacies={pharmacies} />

      <details className="mb-6 rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-lg font-semibold">Création pharmacie seule (sans compte)</summary>
        <p className="mt-2 mb-3 text-sm text-gray-600">
          Pour une officine sans titulaire ou rattachement manuel par UUID ci-dessous.
        </p>
      <section className="mt-2">
        <h2 className="mb-3 text-lg font-semibold sr-only">Creer une pharmacie</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreatePharmacy}>
          <input
            className="rounded-lg border p-3"
            placeholder="Nom"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
          />
          <PharmacyCitySelect
            className="rounded-lg border p-3"
            value={ville}
            onChange={setVille}
            required
            placeholder="Ville"
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
          <AdminPharmacyCoordsFields
            latitude={latitude}
            longitude={longitude}
            onLatitudeChange={setLatitude}
            onLongitudeChange={setLongitude}
            required
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
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={publicListed}
              onChange={(e) => setPublicListed(e.target.checked)}
            />
            <span>Visible dans l&apos;annuaire public</span>
          </label>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white">
            Creer
          </button>
        </form>
      </section>
      </details>

      <details className="mb-6 rounded-xl border bg-white p-4">
        <summary className="cursor-pointer text-lg font-semibold">Assigner un pharmacien existant (UUID)</summary>
        <p className="mt-2 mb-3 text-sm text-amber-800">
          Le rôle <code className="text-xs">pharmacien</code> doit déjà être défini sur le profil. Préférez le
          formulaire « Nouvelle officine » ci-dessus.
        </p>
      <section className="mt-2">
        <h2 className="mb-3 text-lg font-semibold sr-only">Assigner un pharmacien</h2>
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
      </details>

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
