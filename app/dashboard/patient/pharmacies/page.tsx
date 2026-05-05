"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { one } from "@/lib/embed";
import { supabase } from "@/lib/supabase";

type PharmRow = {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  requestCount: number;
};

export default function PatientPharmaciesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pharmacies, setPharmacies] = useState<PharmRow[]>([]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/patient/pharmacies");
      return;
    }

    const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pe || (profile as { role?: string } | null)?.role !== "patient") {
      setError(pe?.message ?? "Cet écran est réservé aux patients.");
      setLoading(false);
      return;
    }

    const { data: reqData, error: re } = await supabase
      .from("requests")
      .select("pharmacy_id, pharmacies(id,nom,ville,adresse)")
      .eq("patient_id", user.id);

    if (re) {
      setError(re.message);
      setLoading(false);
      return;
    }

    const byId = new Map<string, PharmRow>();
    for (const row of reqData ?? []) {
      const raw = row as { pharmacy_id: string; pharmacies: unknown };
      const ph = one(raw.pharmacies) as { id: string; nom: string; ville: string; adresse: string } | null;
      if (!ph?.id) continue;
      const cur = byId.get(ph.id);
      if (cur) {
        cur.requestCount += 1;
      } else {
        byId.set(ph.id, {
          id: ph.id,
          nom: ph.nom,
          ville: ph.ville,
          adresse: ph.adresse,
          requestCount: 1,
        });
      }
    }

    setPharmacies([...byId.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr")));
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Mes pharmacies</h1>
        <p className="text-xs text-muted-foreground">
          Pharmacies auprès desquelles vous avez déjà une demande enregistrée.
        </p>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {pharmacies.length === 0 && !error ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p>Aucune pharmacie pour l’instant.</p>
          <Link href="/" className="mt-3 inline-block text-sm font-medium text-sky-700 underline">
            Parcourir l’annuaire
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {pharmacies.map((p) => (
            <li key={p.id} className="rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
              <p className="font-semibold text-foreground">{p.nom}</p>
              <p className="text-xs text-muted-foreground">
                {p.ville} · {p.adresse}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.requestCount} demande{p.requestCount > 1 ? "s" : ""}
              </p>
              <Link href={`/pharmacie/${p.id}`} className="mt-2 inline-block text-xs font-medium text-sky-700 underline">
                Voir la fiche
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
