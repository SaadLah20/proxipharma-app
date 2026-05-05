"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

type DirRow = {
  patient_id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
};

export default function PharmacienClientsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<DirRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/clients");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Cet écran est réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setRows((data ?? []) as DirRow[]);
    }
    setLoading(false);
  }, [router]);

  const filteredRows = useMemo(() => {
    if (searchQuery.trim().length < 2) return rows;
    return rows.filter((r) =>
      rowMatchesPublicRefQuery(searchQuery, [r.patient_ref, r.full_name, r.email, r.whatsapp, formatShortId(r.patient_id)])
    );
  }, [rows, searchQuery]);

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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-xs font-medium text-sky-800 underline">
            ← Annuaire
          </Link>
          <h1 className="mt-2 text-lg font-bold text-foreground">Clients</h1>
          <p className="text-xs text-muted-foreground">Patients ayant au moins une demande sur votre officine.</p>
        </div>
        <Link
          href="/dashboard/pharmacien/demandes"
          className="shrink-0 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted/50"
        >
          Demandes de produits
        </Link>
      </div>

      <label className="flex max-w-md flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Recherche (code client, nom, téléphone…)
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Ex. P0001-X"
          className="rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/70"
        />
      </label>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {rows.length === 0 && !error ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun patient enregistré pour l’instant.
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun client ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredRows.map((r) => (
            <li key={r.patient_id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
              {r.patient_ref?.trim() ? (
                <p className="font-mono text-[11px] font-bold text-emerald-900">{r.patient_ref.trim()}</p>
              ) : null}
              <p className="font-semibold text-foreground">{r.full_name?.trim() || "Patient"}</p>
              {r.whatsapp ? (
                <a href={`https://wa.me/${r.whatsapp.replace(/\D/g, "")}`} className="mt-1 block text-xs text-emerald-700 underline">
                  WhatsApp {r.whatsapp}
                </a>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">WhatsApp non renseigné</p>
              )}
              {r.email ? <p className="mt-1 text-xs text-muted-foreground">{r.email}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
