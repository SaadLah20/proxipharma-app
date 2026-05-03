"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { patientDashboardSections, requestStatusFr, requestTypeFr } from "@/lib/request-display";
import {
  ALL_REQUEST_STATUSES,
  ALL_REQUEST_TYPES,
  DemandeHubTabBar,
  type HubTab,
  PatientDemandeCard,
  type PatientRequestRow,
} from "@/components/requests/demande-hub-ui";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PatientDemandesHub() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab = tabFromSearch(searchParams.get("vue"));

  const setTab = (t: HubTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", tabToSearch(t));
    router.replace(`/dashboard/demandes?${next.toString()}`, { scroll: false });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PatientRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/demandes");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "patient") {
      setError("Cet espace est réservé aux patients.");
      setLoading(false);
      return;
    }

    const { data, error: re } = await supabase
      .from("requests")
      .select("id,created_at,status,request_type,pharmacy_id,submitted_at,responded_at,pharmacies(nom,ville)")
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(180);

    if (re) {
      setError(re.message);
    } else if (Array.isArray(data)) {
      setRows(data as unknown as PatientRequestRow[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filteredSorted = useMemo(() => {
    let list = rows;
    if (statusFilter) {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (typeFilter) {
      list = list.filter((r) => r.request_type === typeFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNewestFirst ? tb - ta : ta - tb;
    });
  }, [rows, statusFilter, typeFilter, sortNewestFirst]);

  const sectionRows = useMemo(() => {
    const map = new Map<string, PatientRequestRow[]>();
    for (const sec of patientDashboardSections) {
      const set = new Set(sec.statuses);
      map.set(sec.id, rows.filter((r) => set.has(r.status)));
    }
    return map;
  }, [rows]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6">
        <p className="text-slate-600">Chargement…</p>
      </main>
    );
  }

  if (error && rows.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl p-6 pb-16">
        <Link href="/dashboard" className="text-sm font-medium text-sky-800 underline">
          ← Mon espace
        </Link>
        <p className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-6 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-sky-800 underline">
            ← Mon espace
          </Link>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">Mes demandes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Produits et autres demandes auprès des pharmacies ; suivi clair comme une app bancaire.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Annuaire
        </Link>
      </div>

      <div className="mt-8">
        <DemandeHubTabBar
          tab={tab}
          onTab={setTab}
          labels={{ dashboard: "Tableau de bord", list: "Toutes les demandes" }}
        />
      </div>

      {tab === "dashboard" ? (
        <>
          {rows.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
              <p className="font-medium text-slate-900">Aucune demande pour le moment</p>
              <p className="mt-2 text-sm text-slate-600">
                Ouvre une pharmacie dans l&apos;annuaire et utilise « Demander des produits » pour lancer ta première
                demande.
              </p>
              <Link
                href="/"
                className="mt-6 inline-flex rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-800"
              >
                Parcourir les pharmacies
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-10">
              {patientDashboardSections.map((sec) => {
                const list = sectionRows.get(sec.id) ?? [];
                if (list.length === 0) return null;
                return (
                  <section key={sec.id}>
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">{sec.title}</h2>
                        <p className="text-xs text-slate-600">{sec.description}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                        {list.length}
                      </span>
                    </div>
                    <ul className="space-y-3">
                      {list.map((r) => (
                        <li key={r.id}>
                          <PatientDemandeCard row={r} />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">
              Statut
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm"
              >
                <option value="">Tous</option>
                {ALL_REQUEST_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {requestStatusFr[st] ?? st}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1 text-xs font-semibold text-slate-700">
              Type
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm"
              >
                <option value="">Tous</option>
                {ALL_REQUEST_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {requestTypeFr[t] ?? t}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[180px] flex-col gap-1 text-xs font-semibold text-slate-700">
              Tri par date de création
              <select
                value={sortNewestFirst ? "desc" : "asc"}
                onChange={(e) => setSortNewestFirst(e.target.value === "desc")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm"
              >
                <option value="desc">Plus récentes d’abord</option>
                <option value="asc">Plus anciennes d’abord</option>
              </select>
            </label>
          </div>

          {filteredSorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-600">Aucune demande ne correspond aux filtres.</p>
          ) : (
            <ul className="space-y-3">
              {filteredSorted.map((r) => (
                <li key={r.id}>
                  <PatientDemandeCard row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
