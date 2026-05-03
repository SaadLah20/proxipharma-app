"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PharmacistDemandeCard,
  type PharmacistRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam, PHARMACIST_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PharmacistDemandesHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("vue"));

  const setTab = (t: HubTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", tabToSearch(t));
    if (t === "dashboard") {
      next.delete("statut");
    }
    router.replace(`/dashboard/pharmacien/demandes?${next.toString()}`, { scroll: false });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PharmacistRequestRow[]>([]);
  const [patientFilter, setPatientFilter] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);

  const statutParam = searchParams.get("statut");
  const activeBucket = bucketForStatusParam(statutParam);

  const load = useCallback(async () => {
    setError("");
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

    const { data, error: re } = await supabase
      .from("requests")
      .select("id,created_at,status,request_type,patient_id,submitted_at,responded_at")
      .eq("pharmacy_id", staff.pharmacy_id)
      .eq("request_type", "product_request")
      .order("created_at", { ascending: false })
      .limit(220);

    if (re) {
      setError(re.message);
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as PharmacistRequestRow[];
    const { data: directory, error: dirErr } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
    let enriched = raw;
    if (dirErr) {
      setError(dirErr.message);
    } else {
      type DirRow = { patient_id: string; full_name: string | null; whatsapp: string | null; email: string | null };
      const map = new Map((directory as DirRow[] | null)?.map((p) => [p.patient_id, p]) ?? []);
      enriched = raw.map((r) => {
        const p = map.get(r.patient_id);
        return {
          ...r,
          patient_full_name: p?.full_name ?? null,
          patient_whatsapp: p?.whatsapp ?? null,
        };
      });
    }
    setRows(enriched);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const patientOptions = useMemo(() => {
    const ids = [...new Set(rows.map((r) => r.patient_id))];
    return ids.sort();
  }, [rows]);

  const patientSelectLabel = useCallback(
    (pid: string) => {
      const row = rows.find((r) => r.patient_id === pid);
      const name = row?.patient_full_name?.trim();
      return name ? `${name} · #${formatShortId(pid)}` : `Patient #${formatShortId(pid)}`;
    },
    [rows]
  );

  const filteredSorted = useMemo(() => {
    let list = rows;
    if (activeBucket) {
      const allow = new Set(activeBucket.statuses);
      list = list.filter((r) => allow.has(r.status));
    }
    if (patientFilter) {
      list = list.filter((r) => r.patient_id === patientFilter);
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNewestFirst ? tb - ta : ta - tb;
    });
  }, [rows, activeBucket, patientFilter, sortNewestFirst]);

  const setStatutFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (key === "") {
      next.delete("statut");
    } else {
      next.set("statut", key);
    }
    router.replace(`/dashboard/pharmacien/demandes?${next.toString()}`, { scroll: false });
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
        <Link href="/dashboard" className="text-xs font-medium text-emerald-900 underline">
          ← Mon espace
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <Link href="/dashboard" className="text-xs font-medium text-emerald-900 underline">
        ← Mon espace
      </Link>
      <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">Demandes</h1>
      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">Demandes enregistrées pour ta pharmacie.</p>

      <div className="mt-1">
        <DemandeHubTabBar
          tab={tab}
          onTab={setTab}
          labels={{ dashboard: "Tableau de bord", list: "Toutes les demandes" }}
        />
      </div>

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-950">{error}</p>
      ) : null}

      {tab === "dashboard" ? (
        <>
          {rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">Aucune demande</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Les dossiers patients apparaîtront ici.</p>
            </div>
          ) : (
            <div className="mt-4">
              <DemandeStatDashboard rows={rows} buckets={PHARMACIST_DASHBOARD_BUCKETS} basePath="/dashboard/pharmacien/demandes" />
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
                {PHARMACIST_DASHBOARD_BUCKETS.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Patient
              <select
                value={patientFilter}
                onChange={(e) => setPatientFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
              >
                <option value="">Tous</option>
                {patientOptions.map((pid) => (
                  <option key={pid} value={pid}>
                    {patientSelectLabel(pid)}
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
                  <PharmacistDemandeCard row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageShell>
  );
}
