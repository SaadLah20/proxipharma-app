"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

type Pharmacy = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  telephone: string | null;
};

export default function PharmacienMaFichePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/ma-fiche");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Cet écran est réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data: staff, error: se } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (se || !staff?.pharmacy_id) {
      setError(se?.message ?? "Aucune pharmacie liée (pharmacy_staff).");
      setLoading(false);
      return;
    }

    const { data: ph, error: pe } = await supabase
      .from("pharmacies")
      .select("id,nom,ville,adresse,telephone")
      .eq("id", staff.pharmacy_id)
      .maybeSingle();

    if (pe) {
      setError(pe.message);
    } else if (ph) {
      setPharmacy(ph as Pharmacy);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Ma fiche pharmacie</h1>
        <p className="text-xs text-muted-foreground">Informations affichées dans l’annuaire public.</p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {pharmacy ? (
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold text-foreground">{pharmacy.nom}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Ville</dt>
              <dd>{pharmacy.ville}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Adresse</dt>
              <dd>{pharmacy.adresse}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Téléphone</dt>
              <dd>{pharmacy.telephone ?? "—"}</dd>
            </div>
          </dl>
          <Link
            href={`/pharmacie/${pharmacy.id}`}
            className="mt-4 inline-block text-sm font-medium text-emerald-800 underline"
          >
            Voir la fiche publique
          </Link>
        </div>
      ) : null}
    </PageShell>
  );
}
