"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { AdminOnboardPharmacyForm } from "@/components/admin/AdminOnboardPharmacyForm";
import {
  AdminPharmacyCoordsFields,
  validateAdminPharmacyCoordsForSubmit,
} from "@/components/admin/AdminPharmacyCoordsFields";
import { AdminPharmacyList, type AdminPharmacyRow } from "@/components/admin/admin-pharmacy-list";
import { AdminPilotAccessList, type AdminPilotProfileRow } from "@/components/admin/admin-pilot-access-list";
import { AdminSettingsSection } from "@/components/admin/admin-settings-section";
import { PharmacyCitySelect } from "@/components/pharmacy/pharmacy-city-select";
import { lookupPharmacyCity, validatePharmacyCityForSubmit } from "@/lib/pharmacy-cities-morocco";
import { parseAdminPharmacyCoords } from "@/lib/pharmacy-coords-morocco";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

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

export default function AdminOfficinesPage() {
  const searchParams = useSearchParams();
  const listFilter = searchParams.get("filtre") === "public" ? "public" : "all";

  const [message, setMessage] = useState("");
  const [pharmacies, setPharmacies] = useState<AdminPharmacyRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pilotProfiles, setPilotProfiles] = useState<AdminPilotProfileRow[]>([]);

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
  const [setPharmacistRole, setSetPharmacistRole] = useState(true);

  const loadData = useCallback(async () => {
    const [{ data: pharmaciesData }, { data: assignmentsData }, { data: profilesData }] = await Promise.all([
      supabase
        .from("pharmacies")
        .select("id,nom,ville,statut,public_listed")
        .order("created_at", { ascending: false }),
      supabase.from("pharmacy_staff").select("*").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id,full_name,email,role,pilot_access")
        .eq("role", "patient")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (pharmaciesData) {
      setPharmacies(pharmaciesData as AdminPharmacyRow[]);
      setSelectedPharmacyId((current) => current || pharmaciesData[0]?.id || "");
    }

    if (profilesData) {
      setPilotProfiles(profilesData as AdminPilotProfileRow[]);
    }

    if (assignmentsData) {
      const staffRows = assignmentsData as Assignment[];
      const pharmacyMap = new Map((pharmaciesData as AdminPharmacyRow[] | null)?.map((ph) => [ph.id, ph.nom]) ?? []);
      const userIds = [...new Set(staffRows.map((row) => row.user_id))];

      let profileMap = new Map<string, { full_name: string | null; email: string | null }>();

      if (userIds.length > 0) {
        const { data: staffProfiles } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", userIds);

        profileMap = new Map(
          (staffProfiles ?? []).map((row) => [
            row.id as string,
            { full_name: (row.full_name as string | null) ?? null, email: (row.email as string | null) ?? null },
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
    const tid = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(tid);
  }, [loadData]);

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
      setMessage(`Erreur création pharmacie : ${error.message}`);
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
    setMessage("Pharmacie créée. Horaires Maroc par défaut appliqués automatiquement.");
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
      setMessage(`Erreur assignation : ${error.message}`);
      return;
    }

    if (setPharmacistRole) {
      const { error: roleErr } = await supabase
        .from("profiles")
        .update({ role: "pharmacien" })
        .eq("id", pharmacienUserId);
      if (roleErr) {
        setMessage(`Assignation OK, mais rôle pharmacien non mis à jour : ${roleErr.message}`);
        await loadData();
        return;
      }
    }

    setPharmacienUserId("");
    setMessage(setPharmacistRole ? "Pharmacien assigné et rôle mis à jour." : "Pharmacien assigné avec succès.");
    await loadData();
  };

  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Officines pilote"
        subtitle="Création d'officines, visibilité annuaire, rattachements titulaires et accès pilote patient."
      />

      {message ? (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</p>
      ) : null}

      <AdminOnboardPharmacyForm onCreated={loadData} />

      <AdminSettingsSection
        title={`Officines enregistrées (${pharmacies.length})`}
        subtitle={listFilter === "public" ? "Filtre : visibles dans l'annuaire public." : "Toutes les officines du pilote."}
        defaultOpen
      >
        <AdminPharmacyList pharmacies={pharmacies} filter={listFilter} onUpdated={loadData} />
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Accès pilote annuaire (patients)"
        subtitle="Comptes autorisés à voir les officines non listées publiquement."
        defaultOpen={false}
      >
        <AdminPilotAccessList profiles={pilotProfiles} onUpdated={loadData} />
      </AdminSettingsSection>

      <AdminSettingsSection title="Assignations titulaires" subtitle="Liens officine ↔ compte pharmacien." defaultOpen>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune assignation pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((item) => (
              <li key={item.id} className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{item.pharmacy_name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.pharmacist_name || item.pharmacist_email || "Pharmacien non renseigné"} ·{" "}
                  {item.is_owner ? "Titulaire" : "Staff"} · {item.user_id.slice(0, 8)}…
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Création pharmacie seule (sans compte)"
        subtitle="Officine sans titulaire ou rattachement manuel par UUID."
        defaultOpen={false}
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreatePharmacy}>
          <input className="rounded-lg border border-input p-3 text-sm" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
          <PharmacyCitySelect className="rounded-lg border border-input p-3 text-sm" value={ville} onChange={setVille} required placeholder="Ville" />
          <input className="rounded-lg border border-input p-3 text-sm md:col-span-2" placeholder="Adresse" value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
          <input className="rounded-lg border border-input p-3 text-sm" placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
          <input className="rounded-lg border border-input p-3 text-sm" placeholder="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
          <AdminPharmacyCoordsFields latitude={latitude} longitude={longitude} onLatitudeChange={setLatitude} onLongitudeChange={setLongitude} required />
          <select className="rounded-lg border border-input p-3 text-sm md:col-span-2" value={statut} onChange={(e) => setStatut(e.target.value)} required>
            <option value="ouverte">Ouverte</option>
            <option value="fermee">Fermée</option>
            <option value="garde">Garde</option>
          </select>
          <label className="flex items-start gap-2 text-sm md:col-span-2">
            <input type="checkbox" className="mt-0.5" checked={publicListed} onChange={(e) => setPublicListed(e.target.checked)} />
            <span>Visible dans l&apos;annuaire public</span>
          </label>
          <button type="submit" className={clsx(p.cta, "md:col-span-2 w-fit")}>
            Créer l&apos;officine
          </button>
        </form>
      </AdminSettingsSection>

      <AdminSettingsSection
        title="Assigner un pharmacien existant (UUID)"
        subtitle="Préférez le formulaire « Nouvelle officine » pour un onboarding complet."
        defaultOpen={false}
      >
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAssignPharmacien}>
          <select className="rounded-lg border border-input p-3 text-sm" value={selectedPharmacyId} onChange={(e) => setSelectedPharmacyId(e.target.value)} required>
            <option value="">Choisir une pharmacie</option>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.nom} ({pharmacy.ville})
              </option>
            ))}
          </select>
          <input className="rounded-lg border border-input p-3 font-mono text-xs" placeholder="UUID user pharmacien" value={pharmacienUserId} onChange={(e) => setPharmacienUserId(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.target.checked)} />
            Pharmacien propriétaire
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={setPharmacistRole} onChange={(e) => setSetPharmacistRole(e.target.checked)} />
            Définir le rôle <code className="text-xs">pharmacien</code> sur le profil
          </label>
          <button type="submit" className={clsx(p.ctaOutline, "w-fit md:col-span-2")}>
            Assigner
          </button>
        </form>
      </AdminSettingsSection>
    </div>
  );
}
