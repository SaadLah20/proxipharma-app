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
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
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
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const statutParam = searchParams.get("statut");
  const activeBucket = bucketForStatusParam(statutParam, PHARMACIST_DASHBOARD_BUCKETS);

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
      .select("id,created_at,status,request_type,patient_id,submitted_at,responded_at,request_public_ref,request_items(counter_outcome,is_selected_by_patient)")
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
      type DirRow = {
        patient_id: string;
        full_name: string | null;
        whatsapp: string | null;
        email: string | null;
        patient_ref: string | null;
      };
      const map = new Map((directory as DirRow[] | null)?.map((p) => [p.patient_id, p]) ?? []);
      enriched = raw.map((r) => {
        const p = map.get(r.patient_id);
        return {
          ...r,
          patient_full_name: p?.full_name ?? null,
          patient_whatsapp: p?.whatsapp ?? null,
          patient_ref: p?.patient_ref ?? null,
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
      const pref = row?.patient_ref?.trim();
      const tag = pref ? pref : `#${formatShortId(pid)}`;
      return name ? `${name} · ${tag}` : `Patient ${tag}`;
    },
    [rows]
  );

  const rowsWithDashboardStatus = useMemo(
    () =>
      rows.map((r) => {
        const rawItems = ((r as unknown as { request_items?: Array<{ counter_outcome?: string | null; is_selected_by_patient?: boolean | null }> }).request_items ??
          []) as Array<{ counter_outcome?: string | null; is_selected_by_patient?: boolean | null }>;
        const hasExecutionProgress =
          r.status === "confirmed" &&
          rawItems.some((it) => (it.counter_outcome ?? "unset") !== "unset");
        return {
          ...r,
          status_for_dashboard: hasExecutionProgress ? "in_progress_virtual" : r.status,
        };
      }),
    [rows]
  );

  const filteredSorted = useMemo(() => {
    let list = rowsWithDashboardStatus;
    if (activeBucket) {
      const allow = new Set(activeBucket.statuses);
      list = list.filter((r) => allow.has((r as { status_for_dashboard?: string }).status_for_dashboard ?? r.status));
    }
    if (patientFilter) {
      list = list.filter((r) => r.patient_id === patientFilter);
    }
    if (refQuery.trim().length >= 2) {
      list = list.filter((r) =>
        rowMatchesPublicRefQuery(refQuery, [
          r.request_public_ref,
          r.patient_ref,
          r.patient_full_name,
          formatShortId(r.id),
          formatShortId(r.patient_id),
        ])
      );
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNewestFirst ? tb - ta : ta - tb;
    });
  }, [rowsWithDashboardStatus, activeBucket, patientFilter, refQuery, sortNewestFirst]);

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
        <Link href="/dashboard/pharmacien" className="text-xs font-medium text-emerald-900 underline">
          ← Tableau de bord
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <Link href="/dashboard/pharmacien" className="text-xs font-medium text-emerald-900 underline">
        ← Tableau de bord
      </Link>
      <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">Demandes de produits</h1>
      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
        Tableau de bord et liste comme côté patient — traiter les dossiers depuis votre officine.
      </p>

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
              <DemandeStatDashboard rows={rowsWithDashboardStatus} buckets={PHARMACIST_DASHBOARD_BUCKETS} basePath="/dashboard/pharmacien/demandes" />
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <section className="rounded-xl border-2 border-emerald-100 bg-emerald-50/40 p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-950">Filtres et recherche</h2>
                <p className="text-[10px] text-emerald-900/85">Référence demande pour accès direct</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className="rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50"
              >
                {filtersOpen ? "Masquer" : "Afficher"}
              </button>
            </div>
            {filtersOpen ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
            <label className="flex min-w-0 flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2 lg:col-span-1">
              Référence demande / client
              <input
                value={refQuery}
                onChange={(e) => setRefQuery(e.target.value)}
                placeholder="Ex. D042/26"
                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70"
              />
            </label>
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
            ) : (
              <p className="mt-2 text-[11px] text-emerald-900/85">
                Ouvrez les filtres pour retrouver rapidement un dossier client.
              </p>
            )}
          </section>

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
