"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatShortId, requestStatusFr, requestTypeFr } from "@/lib/request-display";

type Row = {
  id: string;
  created_at: string;
  status: string;
  request_type: string;
  patient_id: string;
};

export default function PharmacienDemandesListePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/demandes");
        return;
      }

      const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (pe || !profile || (profile as { role: string }).role !== "pharmacien") {
        setError("Accès réservé aux comptes pharmacien.");
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
        setError("Aucune pharmacie rattachée à ton compte (pharmacy_staff).");
        setLoading(false);
        return;
      }

      setPharmacyId(staff.pharmacy_id);

      const { data, error: re } = await supabase
        .from("requests")
        .select("id,created_at,status,request_type,patient_id")
        .eq("pharmacy_id", staff.pharmacy_id)
        .in("status", ["submitted", "in_review", "responded", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(60);

      if (re) {
        setError(re.message);
      } else if (Array.isArray(data)) {
        setRows(data as Row[]);
      }
      setLoading(false);
    };

    void run();
  }, [router]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <p className="text-gray-600">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6 pb-12">
      <Link href="/dashboard" className="text-sm font-medium text-blue-700 underline">
        ← Mon espace
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-blue-950">Demandes de la pharmacie</h1>
      <p className="mt-1 text-sm text-gray-600">
        Demandes actives (envoyées à traiter, en cours, réponse publiée ou confirmée par le patient).
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      ) : null}

      {pharmacyId && rows.length === 0 && !error ? (
        <p className="mt-6 text-sm text-gray-600">Aucune demande dans cette file pour l’instant.</p>
      ) : null}

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs text-gray-500">#{formatShortId(r.id)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                {requestStatusFr[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-900">
              <span className="font-medium">{requestTypeFr[r.request_type] ?? r.request_type}</span>
              <span className="text-gray-500">
                {" "}
                · patient <span className="font-mono text-xs">{formatShortId(r.patient_id)}</span>
              </span>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
            </p>
            <Link
              href={`/dashboard/pharmacien/demandes/${r.id}`}
              className="mt-3 inline-block text-sm font-semibold text-blue-800 underline"
            >
              Ouvrir
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
