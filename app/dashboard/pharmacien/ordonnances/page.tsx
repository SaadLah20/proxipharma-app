"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { displayRequestPublicRef } from "@/lib/public-ref";
import { requestStatusFr } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

type RequestRow = {
  id: string;
  created_at: string;
  status: string;
  submitted_at: string | null;
  request_public_ref: string | null;
};

export default function PharmacienOrdonnancesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/ordonnances");
      return;
    }
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr || (profile as { role?: string } | null)?.role !== "pharmacien") {
      setError(profileErr?.message ?? "Accès pharmacien uniquement.");
      setLoading(false);
      return;
    }
    const { data: staff, error: staffErr } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (staffErr || !staff?.pharmacy_id) {
      setError(staffErr?.message ?? "Pharmacie non rattachée.");
      setLoading(false);
      return;
    }
    const { data, error: reqErr } = await supabase
      .from("requests")
      .select("id,created_at,status,submitted_at,request_public_ref")
      .eq("pharmacy_id", staff.pharmacy_id)
      .eq("request_type", "prescription")
      .order("created_at", { ascending: false });
    if (reqErr) {
      setError(reqErr.message);
      setLoading(false);
      return;
    }
    setRequests((data as RequestRow[]) ?? []);
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
        <Link href="/dashboard/pharmacien" className="text-xs font-medium text-emerald-900 underline">
          ← Tableau de bord
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Ordonnances</h1>
        <p className="text-xs text-muted-foreground">Ordonnances reçues par votre officine.</p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {requests.length === 0 && !error ? (
        <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-950">
          Aucune ordonnance reçue pour l’instant.
        </div>
      ) : (
        <ul className="space-y-2">
          {requests.map((row) => (
            <li key={row.id} className="rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
              <p className="font-mono text-[11px] font-medium text-foreground">{displayRequestPublicRef(row)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.submitted_at ? new Date(row.submitted_at).toLocaleString("fr-FR") : new Date(row.created_at).toLocaleString("fr-FR")}
              </p>
              <p className="mt-1 text-xs font-medium text-foreground">{requestStatusFr[row.status] ?? row.status}</p>
              <Link
                href={`/dashboard/pharmacien/demandes/${row.id}`}
                className="mt-2 inline-block text-xs font-medium text-emerald-700 underline"
              >
                Ouvrir le détail
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
