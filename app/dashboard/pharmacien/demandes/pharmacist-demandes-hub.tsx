"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PharmacistDemandeCard,
  type PharmacistRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PharmacistProductDemandesDashboard } from "@/components/requests/product/pharmacist-product-demandes-dashboard";
import { PharmacistProductDemandeHubCard } from "@/components/requests/product/pharmacist-product-demande-hub-card";
import { ProductHubListResultsBar } from "@/components/requests/product/product-hub-list-results-bar";
import { filterPharmacistProductHubListRows } from "@/lib/pharmacist-product-hub-sections";
import { productRequestPublicTheme as productTheme } from "@/lib/request-kinds/product-request-public-theme";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { dashboardBucketsForKind, hubDashboardChrome } from "@/lib/request-kinds/hub-and-terminal-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PharmacistRequestKindHub({ kindId }: { kindId: RequestKindId }) {
  const kindConfig = getRequestKindConfig(kindId);
  const hubPath = kindConfig.routes.pharmacistHubPath;
  const accent = kindConfig.theme.accent;
  const refPlaceholder =
    kindConfig.publicRefPrefix === "O" ? "Ex. O042/26" : kindConfig.publicRefPrefix === "C" ? "Ex. C042/26" : "Ex. D042/26";

  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("vue"));

  const setTab = (t: HubTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", tabToSearch(t));
    if (t === "dashboard") {
      next.delete("statut");
      next.delete("section");
    }
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const isProductHub = kindId === "product_request";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PharmacistRequestRow[]>([]);
  const [unreadById, setUnreadById] = useState<Record<string, boolean>>({});
  const [patientFilter, setPatientFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const dashboardBuckets = useMemo(() => dashboardBucketsForKind(kindId, "pharmacien"), [kindId]);
  const dashboardChrome = useMemo(() => hubDashboardChrome(kindId, "pharmacien"), [kindId]);

  const listStatutParam = tab === "list" ? searchParams.get("statut") : null;
  const activeBucket = bucketForStatusParam(listStatutParam, dashboardBuckets);

  useEffect(() => {
    if (tab !== "dashboard") return;
    const hasListOnlyParams = searchParams.has("statut") || searchParams.has("section");
    if (!hasListOnlyParams) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("statut");
    next.delete("section");
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  }, [tab, searchParams, router, hubPath]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=${encodeURIComponent(hubPath)}`);
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

    const itemsSelect =
      kindId === "product_request"
        ? "request_items(requested_qty,selected_qty,available_qty,unit_price,is_selected_by_patient,line_source,patient_chosen_alternative_id,counter_outcome,post_confirm_fulfillment,availability_status,products(price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,unit_price))"
        : "request_items(counter_outcome,is_selected_by_patient,post_confirm_fulfillment)";
    let q = supabase
      .from("requests")
      .select(
        `id,created_at,updated_at,status,request_type,patient_id,submitted_at,responded_at,request_public_ref,${itemsSelect}`
      )
      .eq("pharmacy_id", staff.pharmacy_id)
      .eq("request_type", kindId);
    if (kindId === "prescription") {
      q = q.neq("status", "draft");
    }
    const { data, error: re } = await q.order("created_at", { ascending: false }).limit(220);

    if (re) {
      setError(re.message);
      setUnreadById({});
      setLoading(false);
      return;
    }

    const raw = (data ?? []) as unknown as PharmacistRequestRow[];
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

    const ids = enriched.map((r) => r.id);
    const unreadMap: Record<string, boolean> = {};
    if (ids.length > 0) {
      const { data: flagData, error: unreadErr } = await supabase.rpc("request_conversation_unread_flags", {
        p_request_ids: ids,
      });
      if (!unreadErr && Array.isArray(flagData)) {
        for (const fr of flagData as { request_id: string; has_unread: boolean }[]) {
          if (fr.request_id) unreadMap[fr.request_id] = fr.has_unread === true;
        }
      }
    }
    setUnreadById(unreadMap);

    setLoading(false);
  }, [router, hubPath, kindId]);

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

  const rowsWithDashboardStatus = useMemo(() => rows.map((r) => ({ ...r, status_for_dashboard: r.status })), [rows]);

  const filteredSorted = useMemo(() => {
    let list = rowsWithDashboardStatus;
    if (isProductHub) {
      list = filterPharmacistProductHubListRows(list, {
        bucketStatuses: activeBucket?.statuses ?? null,
      });
    } else if (activeBucket) {
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
  }, [
    rowsWithDashboardStatus,
    activeBucket,
    isProductHub,
    patientFilter,
    refQuery,
    sortNewestFirst,
  ]);

  const setStatutFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (key === "") {
      next.delete("statut");
    } else {
      next.set("statut", key);
    }
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const linkClass =
    accent === "amber"
      ? "text-amber-900 underline"
      : accent === "violet"
        ? "text-violet-900 underline"
        : isProductHub
          ? productTheme.backLink
          : "text-emerald-900 underline";
  const filterShell =
    accent === "amber"
      ? "rounded-lg border border-amber-200/80 bg-amber-50/35 p-2.5 shadow-sm ring-1 ring-amber-200/40"
      : isProductHub
        ? "rounded-xl border-2 border-sky-100 bg-sky-50/50 p-3 shadow-sm"
        : "rounded-lg border border-emerald-200/80 bg-emerald-50/35 p-2.5 shadow-sm ring-1 ring-emerald-200/40";
  const filterTitle = accent === "amber" ? "text-amber-950" : isProductHub ? "text-sky-950" : "text-emerald-950";
  const filterSub = accent === "amber" ? "text-amber-900/85" : isProductHub ? "text-muted-foreground" : "text-emerald-900/85";
  const filterBtn =
    accent === "amber"
      ? "rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-50"
      : isProductHub
        ? "rounded-md border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-900 shadow-sm hover:bg-sky-50"
        : "rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-900 shadow-sm hover:bg-emerald-50";

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
        <Link href="/dashboard/pharmacien" className={clsx("text-xs font-medium", linkClass)}>
          ← Tableau de bord
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      maxWidthClass="max-w-3xl"
      className="space-y-4"
    >
      <Link href="/dashboard/pharmacien" className={clsx("text-xs font-medium", linkClass)}>
        ← Tableau de bord
      </Link>
      <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">{kindConfig.copy.pharmacistHubTitle}</h1>
      <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
        {kindId === "prescription"
          ? "Ordonnances reçues : tableau de bord et liste — lire le scan et saisir les produits."
          : kindId === "free_consultation"
            ? "Consultations libres reçues : lire le message, échanger puis proposer des produits."
            : "Tableau de bord avec repères visuels ; liste complète filtrable par statut, patient ou référence."}
      </p>

      <div className="mt-1">
        <DemandeHubTabBar
          tab={tab}
          onTab={setTab}
          labels={{
            dashboard: "Tableau de bord",
            list:
              kindId === "prescription"
                ? "Toutes les ordonnances"
                : kindId === "free_consultation"
                  ? "Toutes les consultations"
                  : "Toutes les demandes",
          }}
        />
      </div>

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-950">{error}</p>
      ) : null}

      {tab === "dashboard" ? (
        <>
          {rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {kindId === "prescription"
                  ? "Aucune ordonnance"
                  : kindId === "free_consultation"
                    ? "Aucune consultation"
                    : "Aucune demande"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {kindId === "prescription"
                  ? "Les ordonnances envoyées par vos patients apparaîtront ici."
                  : kindId === "free_consultation"
                    ? "Les consultations libres envoyées par vos patients apparaîtront ici."
                    : "Les dossiers patients apparaîtront ici."}
              </p>
            </div>
          ) : (
            <div className="mt-4">
              {isProductHub ? (
                <PharmacistProductDemandesDashboard
                  rows={rows}
                  basePath={hubPath}
                  unreadById={unreadById}
                />
              ) : (
                <DemandeStatDashboard
                  rows={rowsWithDashboardStatus}
                  buckets={dashboardBuckets}
                  basePath={hubPath}
                  density="compact"
                  dashboardTitle={dashboardChrome.title}
                  dashboardSubtitle={dashboardChrome.subtitle}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <section className={filterShell}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className={clsx("text-xs font-bold uppercase tracking-wide", filterTitle)}>Filtres et recherche</h2>
                <p className={clsx("text-[10px]", filterSub)}>Référence demande pour accès direct</p>
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={filterBtn}
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
                placeholder={refPlaceholder}
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
                {dashboardBuckets.map((b) => (
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
              <p className={clsx("mt-2 text-[11px]", isProductHub ? "text-muted-foreground" : "text-emerald-900/85")}>
                Ouvrez les filtres pour retrouver rapidement un dossier client.
              </p>
            )}
          </section>

          {isProductHub ? (
            <ProductHubListResultsBar filteredCount={filteredSorted.length} totalCount={rows.length} />
          ) : (
            <p className="text-[11px] font-semibold tabular-nums text-muted-foreground" role="status">
              {filteredSorted.length === 0
                ? "Aucun dossier affiché"
                : `${filteredSorted.length} dossier${filteredSorted.length > 1 ? "s" : ""} affiché${filteredSorted.length > 1 ? "s" : ""}`}
              {filteredSorted.length !== rows.length && rows.length > 0
                ? ` sur ${rows.length} au total`
                : rows.length > 0
                  ? " (liste complète)"
                  : ""}
            </p>
          )}

          {filteredSorted.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {activeBucket?.key === "envoyees"
                ? kindId === "prescription"
                  ? "Aucune ordonnance à traiter (scan reçu / en relecture) avec ces filtres."
                  : kindId === "free_consultation"
                    ? "Aucune consultation à traiter (message reçu / en relecture) avec ces filtres."
                    : "Aucune demande à prendre en charge (soumise / en relecture) avec ces filtres."
                : activeBucket
                  ? kindId === "prescription"
                    ? "Aucune ordonnance ne correspond aux filtres."
                    : kindId === "free_consultation"
                      ? "Aucune consultation ne correspond aux filtres."
                      : "Aucune demande ne correspond aux filtres."
                  : "Aucun résultat."}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredSorted.map((r) => (
                <li key={r.id} className="list-none">
                  {isProductHub ? (
                    <PharmacistProductDemandeHubCard
                      row={r}
                      conversationUnread={unreadById[r.id] === true}
                    />
                  ) : (
                    <PharmacistDemandeCard row={r} conversationUnread={unreadById[r.id] === true} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageShell>
  );
}

export function PharmacistDemandesHub() {
  return <PharmacistRequestKindHub kindId="product_request" />;
}
