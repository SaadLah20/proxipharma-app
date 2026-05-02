"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MessageCircle, Phone, ShoppingBag } from "lucide-react";
import { supabase } from "@/lib/supabase";

type PharmacyRow = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
  whatsapp: string | null;
  statut: string;
};

export default function PharmacieFichePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const hasId = Boolean(id);
  const [pharmacy, setPharmacy] = useState<PharmacyRow | null>(null);
  const [loading, setLoading] = useState(hasId);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const load = async () => {
      const { data, error: qErr } = await supabase
        .from("pharmacies")
        .select("id,nom,ville,adresse,telephone,whatsapp,statut")
        .eq("id", id)
        .maybeSingle();

      if (qErr) {
        setError(qErr.message);
      } else if (!data) {
        setError("Cette pharmacie n existe pas ou n est plus disponible.");
      } else {
        setPharmacy(data as PharmacyRow);
      }
      setLoading(false);
    };

    void load();
  }, [id]);

  const normalizeWhatsAppNumber = (value: string | null) => (value ?? "").replace(/[^\d]/g, "");

  if (!hasId) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Pharmacie introuvable.
        </div>
        <Link href="/" className="mt-4 block text-center text-sm font-medium text-blue-700">
          Retour à l&apos;annuaire
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <p className="text-gray-600">Chargement de la pharmacie...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 pb-10">
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-4 inline-block text-sm font-medium text-blue-700">
          Retour à l&apos;annuaire
        </Link>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : pharmacy ? (
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-blue-950">{pharmacy.nom}</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {pharmacy.ville} • {pharmacy.adresse}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-100 px-2 py-1 text-xs font-semibold uppercase text-emerald-800">
                {pharmacy.statut}
              </span>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              <a
                href={pharmacy.telephone ? `tel:${pharmacy.telephone}` : undefined}
                aria-disabled={!pharmacy.telephone}
                className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-blue-50 py-3 text-sm font-medium text-blue-800 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <Phone size={18} strokeWidth={2} /> Appeler
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
                className="flex flex-1 min-w-[120px] items-center justify-center gap-2 rounded-xl bg-green-50 py-3 text-sm font-medium text-green-800 aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <MessageCircle size={18} strokeWidth={2} /> WhatsApp
              </a>
            </div>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Services en ligne
              </h2>
              <Link
                href={`/pharmacie/${pharmacy.id}/demande-produits`}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-200 bg-blue-600/5 py-4 text-base font-semibold text-blue-900 transition hover:bg-blue-600/10"
              >
                <ShoppingBag size={22} strokeWidth={2} />
                Demander des produits
              </Link>
              <p className="mt-2 text-xs text-gray-500">
                Recherche dans la base produits, quantités, envoi à la pharmacie (Sprint 2).
              </p>
            </section>
          </article>
        ) : null}
      </div>
    </main>
  );
}
