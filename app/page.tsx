"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, Phone } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
};

export default function Home() {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const [{ data: authData }, { data, error }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from("pharmacies").select("*").order("created_at", { ascending: false }),
      ]);

      if (error) {
        setErrorMessage(error.message);
      }

      if (!error && Array.isArray(data)) {
        setPharmacies(data as Pharmacy[]);
      }

      setSession(authData.session);
      setLoading(false);
    };

    void load();
  }, []);

  if (loading) {
    return <main className="min-h-screen p-6">Chargement...</main>;
  }

  const normalizeWhatsAppNumber = (value: string | null) => (value ?? "").replace(/[^\d]/g, "");

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-blue-900">ProxiPharma</h1>
          <p className="text-gray-600">Pharmacies disponibles ({pharmacies.length})</p>
        </div>
        {session ? (
          <Link
            href="/dashboard"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Mon espace
          </Link>
        ) : (
          <Link
            href="/auth"
            className="rounded-lg border border-blue-600 px-4 py-2 text-sm font-medium text-blue-700"
          >
            Se connecter
          </Link>
        )}
      </header>

      <div className="space-y-4">
        {errorMessage ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Erreur chargement pharmacies: {errorMessage}
          </p>
        ) : null}
        {pharmacies.length > 0 ? (
          pharmacies.map((pharmacy) => (
            <div key={pharmacy.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold">{pharmacy.nom}</h3>
                  <p className="text-sm text-gray-500">
                    {pharmacy.ville} • {pharmacy.adresse}
                  </p>
                </div>
                <span className="rounded-lg bg-green-100 px-2 py-1 text-xs font-bold uppercase text-green-700">
                  {pharmacy.statut}
                </span>
              </div>

              <div className="mt-4 flex gap-2">
                <a
                  href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
                  aria-disabled={!pharmacy.telephone}
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