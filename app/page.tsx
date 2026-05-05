"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trackPharmacyEngagement } from "@/lib/pharmacy-engagement";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
  public_ref?: string | null;
};

export default function Home() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("pharmacies").select("*").order("created_at", { ascending: false });

      if (error) {
        setErrorMessage(error.message);
      }

      if (!error && Array.isArray(data)) {
        setPharmacies(data as Pharmacy[]);
      }

      setLoading(false);
    };

    void load();
  }, []);

  const normalizeWhatsAppNumber = (value: string | null) => (value ?? "").replace(/[^\d]/g, "");

  const filtered = useMemo(() => {
    if (searchQuery.trim().length < 2) return pharmacies;
    return pharmacies.filter((p) =>
      rowMatchesPublicRefQuery(searchQuery, [p.public_ref, p.nom, p.ville, p.adresse, p.telephone, p.whatsapp])
    );
  }, [pharmacies, searchQuery]);

  if (loading) {
    return <main className="min-h-screen p-6">Chargement...</main>;
  }

  return (
    <main className="min-h-0 flex-1 bg-gray-50 p-4 pb-10">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-blue-900">Annuaire</h1>
        <p className="text-sm text-gray-600">
          Pharmacies affichées ({filtered.length}
          {searchQuery.trim().length >= 2 ? ` / ${pharmacies.length}` : ""})
        </p>
        <label className="mt-3 block text-xs font-medium text-gray-700">
          Recherche nom, ville, adresse ou code officine (ex. PH001R)
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tapez au moins 2 caractères…"
            className="mt-1 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none placeholder:text-gray-400 focus:border-blue-400"
          />
        </label>
      </div>

      <div className="space-y-4">
        {errorMessage ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Erreur chargement pharmacies: {errorMessage}
          </p>
        ) : null}
        {filtered.length > 0 ? (
          filtered.map((pharmacy) => (
            <div key={pharmacy.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-[11px] font-semibold tracking-wide text-blue-900/90">
                    {pharmacy.public_ref?.trim() ?? "—"}
                  </p>
                  <h3 className="text-lg font-bold">{pharmacy.nom}</h3>
                  <p className="text-sm text-gray-500">
                    {pharmacy.ville} • {pharmacy.adresse}
                  </p>
                </div>
                <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold uppercase text-green-700">
                  {pharmacy.statut}
                </span>
              </div>

              <Link
                href={`/pharmacie/${pharmacy.id}`}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-blue-900 py-3 text-sm font-semibold text-white"
              >
                Fiche pharmacie <ArrowRight size={16} />
              </Link>
              <div className="mt-2 flex gap-2">
                <a
                  href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
                  aria-disabled={!pharmacy.telephone}
                  onClick={() =>
                    trackPharmacyEngagement({
                      pharmacyId: pharmacy.id,
                      eventType: "phone_click",
                      source: "annuaire",
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 py-2 font-medium text-blue-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <Phone size={16} /> {pharmacy.telephone ?? "Non disponible"}
                </a>
                <a
                  href={
                    normalizeWhatsAppNumber(pharmacy.whatsapp)
                      ? `https://wa.me/${normalizeWhatsAppNumber(pharmacy.whatsapp)}`
                      : undefined
                  }
                  target={normalizeWhatsAppNumber(pharmacy.whatsapp) ? "_blank" : undefined}
                  rel={normalizeWhatsAppNumber(pharmacy.whatsapp) ? "noreferrer" : undefined}
                  aria-disabled={!normalizeWhatsAppNumber(pharmacy.whatsapp)}
                  onClick={() =>
                    trackPharmacyEngagement({
                      pharmacyId: pharmacy.id,
                      eventType: "whatsapp_click",
                      source: "annuaire",
                    })
                  }
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-50 py-2 font-medium text-green-700 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                >
                  <MessageCircle size={16} /> WhatsApp
                </a>
              </div>
            </div>
          ))
        ) : (
          <p className="py-10 text-center text-gray-500">Aucune pharmacie trouvée pour le moment.</p>
        )}
      </div>
    </main>
  );
}