"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PatientDemandeCard,
  type PatientRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam, PATIENT_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { one } from "@/lib/embed";
import { supabase } from "@/lib/supabase";

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
    if (t === "dashboard") {
      next.delete("statut");
    }
    router.replace(`/dashboard/demandes?${next.toString()}`, { scroll: false });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PatientRequestRow[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const statutParam = searchParams.get("statut");
  const activeBucket = bucketForStatusParam(statutParam);

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
      .eq("request_type", "product_request")
      .order("created_at", { ascending: false })
      .limit(200);

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

  const pharmacyOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (m.has(r.pharmacy_id)) continue;
      const ph = one(r.pharmacies);
      m.set(
        r.pharmacy_id,
        ph?.nom ? `${ph.nom} (${ph.ville})` : `Pharmacie ${r.pharmacy_id.slice(0, 8)}…`
      );
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [rows]);

  const filteredSorted = useMemo(() => {
    let list = rows;
    if (activeBucket) {
      const allow = new Set(activeBucket.statuses);
      list = list.filter((r) => allow.has(r.status));
    }
    if (pharmacyFilter) {
      list = list.filter((r) => r.pharmacy_id === pharmacyFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNewestFirst ? tb - ta : ta - tb;
    });
  }, [rows, activeBucket, pharmacyFilter, sortNewestFirst]);

  const setStatutFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (key === "") {
      next.delete("statut");
    } else {
      next.set("statut", key);
    }
    router.replace(`/dashboard/demandes?${next.toString()}`, { scroll: false });
  };

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  if (error && rows.length === 0) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <Link href="/dashboard" className="text-xs font-medium text-sky-800 underline">
          ← Mon espace
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-sky-800 underline">
            ← Mon espace
          </Link>
          <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">Mes demandes</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Demandes auprès des pharmacies.</p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/50"
        >
          Annuaire
        </Link>
      </div>

      <div className="mt-1">
        <DemandeHubTabBar
          tab={tab}
          onTab={setTab}
          labels={{ dashboard: "Tableau de bord", list: "Toutes les demandes" }}
        />
      </div>

      {tab === "dashboard" ? (
        <>
          {rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center sm:p-8">
              <p className="text-sm font-medium text-foreground">Aucune demande</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Annuaire → pharmacie → demande.</p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95"
              >
                Annuaire
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              <DemandeStatDashboard rows={rows} buckets={PATIENT_DASHBOARD_BUCKETS} basePath="/dashboard/demandes" />
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-2 rounded-lg border border-border/80 bg-muted/20 p-2.5 sm:grid-cols-3 sm:items-end">
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Statut
              <select
                value={activeBucket?.key ?? ""}
                onChange={(e) => setStatutFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Tous</option>
                {PATIENT_DASHBOARD_BUCKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pharmacie
              <select
                value={pharmacyFilter}
                onChange={(e) => setPharmacyFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Toutes</option>
                {pharmacyOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Tri date
              <select
                value={sortNewestFirst ? "desc" : "asc"}
                onChange={(e) => setSortNewestFirst(e.target.value === "desc")}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="desc">Plus récentes d’abord</option>
                <option value="asc">Plus anciennes d’abord</option>
              </select>
            </label>
          </div>

          {filteredSorted.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Aucun résultat.</p>
          ) : (
            <ul className="space-y-2">
              {filteredSorted.map((r) => (
                <li key={r.id}>
                  <PatientDemandeCard row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageShell>
  );
}
