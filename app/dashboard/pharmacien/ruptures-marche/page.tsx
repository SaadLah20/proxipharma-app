"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { formatDateTimeShort24hFr } from "@/lib/datetime-fr";
import { one } from "@/lib/embed";

type ShortageRow = {
  id: string;
  created_at: string;
  note: string | null;
  products: { name: string } | { name: string }[] | null;
};

export default function PharmacienRupturesMarchePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ShortageRow[]>([]);
  const [pharmacyNom, setPharmacyNom] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/ruptures-marche");
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

    const { data: ph } = await supabase.from("pharmacies").select("nom").eq("id", staff.pharmacy_id).maybeSingle();
    setPharmacyNom(((ph as { nom?: string } | null)?.nom ?? "").trim() || "Ma pharmacie");

    const { data, error: re } = await supabase
      .from("market_shortages")
      .select("id,created_at,note,products(name)")
      .eq("pharmacy_id", staff.pharmacy_id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (re) {
      setError(re.message);
    } else {
      setRows((data ?? []) as unknown as ShortageRow[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const retire = async (id: string) => {
    if (!window.confirm("Retirer ce produit de la liste « rupture marché » pour votre officine ?")) {
      return;
    }
    setBusyId(id);
    const { error: upErr } = await supabase
      .from("market_shortages")
      .update({ is_active: false, resolved_at: new Date().toISOString() })
      .eq("id", id);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-gray-600">Chargement…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Produits en rupture de marché</h1>
          <p className="text-sm text-gray-600">{pharmacyNom}</p>
        </div>
        <Link href="/dashboard/pharmacien/demandes" className="text-sm text-emerald-800 underline">
          ← Demandes pharmacie
        </Link>
      </div>

      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      <p className="mb-4 text-sm text-gray-700">
        Liste alimentée automatiquement quand vous indiquez la disponibilité « rupture de marché » sur une ligne de
        demande. Retirez un produit dès qu’il redevient disponible chez vous.
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border bg-white p-4 text-sm text-gray-700">Aucune rupture de marché active.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{one(r.products)?.name ?? "?"}</p>
                <p className="text-xs text-gray-500">
                  Depuis le {formatDateTimeShort24hFr(r.created_at)}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === r.id}
                className="shrink-0 rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-900 disabled:opacity-50"
                onClick={() => void retire(r.id)}
              >
                {busyId === r.id ? "…" : "Retirer de la liste"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
