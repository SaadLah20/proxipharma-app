"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search, SlidersHorizontal } from "lucide-react";
import { DemandeStatDashboard } from "@/components/requests/demande-stat-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PatientDemandeCard,
  type PatientRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PatientProductDemandesDashboard } from "@/components/requests/product/patient-product-demandes-dashboard";
import { PatientProductDemandeHubCard } from "@/components/requests/product/patient-product-demande-hub-card";
import {
  filterPatientProductHubListRows,
  PATIENT_PRODUCT_HUB_SECTIONS,
  type PatientProductHubSectionId,
} from "@/lib/patient-product-hub-sections";
import {
  patientHubListActiveFiltersSummary,
  patientHubListHasActiveFilters,
} from "@/lib/patient-request-hub-list-filters";
import { productRequestPublicTheme as productTheme } from "@/lib/request-kinds/product-request-public-theme";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { one } from "@/lib/embed";
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

export function PatientRequestKindHub({ kindId }: { kindId: RequestKindId }) {
  const kindConfig = getRequestKindConfig(kindId);
  const hubPath = kindConfig.routes.patientHubPath;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PatientRequestRow[]>([]);
  const [unreadById, setUnreadById] = useState<Record<string, boolean>>({});
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const isProductHub = kindId === "product_request";
  const dashboardBuckets = useMemo(() => dashboardBucketsForKind(kindId, "patient"), [kindId]);
  const dashboardChrome = useMemo(() => hubDashboardChrome(kindId, "patient"), [kindId]);

  /** Filtres URL : réservés à l’onglet liste — le tableau de bord reste toujours complet. */
  const listStatutParam = tab === "list" ? searchParams.get("statut") : null;
  const listSectionParam = tab === "list" ? (searchParams.get("section") as PatientProductHubSectionId | null) : null;
  const activeBucket = bucketForStatusParam(listStatutParam, dashboardBuckets);
  const activeProductSection =
    tab === "list" &&
    kindId === "product_request" &&
    listSectionParam &&
    PATIENT_PRODUCT_HUB_SECTIONS.some((s) => s.id === listSectionParam)
      ? listSectionParam
      : null;

  useEffect(() => {
    if (tab !== "dashboard") return;
    const hasListOnlyParams = searchParams.has("statut") || searchParams.has("section");
    if (!hasListOnlyParams) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("statut");
    next.delete("section");
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  }, [tab, searchParams, router, hubPath]);

  useEffect(() => {
    if (tab === "list" && (listStatutParam || listSectionParam)) {
      setFiltersOpen(true);
    }
  }, [tab, listStatutParam, listSectionParam]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=${encodeURIComponent(hubPath)}`);
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
      .select(
        "id,created_at,updated_at,status,request_type,pharmacy_id,submitted_at,responded_at,request_public_ref,pharmacies(nom,ville,public_ref)," +
          "request_items(requested_qty,selected_qty,available_qty,unit_price,is_selected_by_patient,line_source,patient_chosen_alternative_id,counter_outcome,post_confirm_fulfillment,availability_status,products(price_pph),request_item_alternatives!request_item_alternatives_request_item_id_fkey(id,unit_price))"
      )
      .eq("patient_id", user.id)
      .eq("request_type", kindId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (re) {
      setError(re.message);
      setUnreadById({});
    } else if (Array.isArray(data)) {
      setRows(data as unknown as PatientRequestRow[]);
      const ids = (data as unknown as { id: string }[]).map((r) => r.id);
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
    } else {
      setUnreadById({});
    }

    setLoading(false);
  }, [router, hubPath, kindId]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const pharmacyOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (m.has(r.pharmacy_id)) continue;
      const ph = one(r.pharmacies);
      m.set(r.pharmacy_id, ph?.nom ? `${ph.nom} (${ph.ville})` : `Pharmacie ${r.pharmacy_id.slice(0, 8)}…`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [rows]);

  const rowsWithDashboardStatus = useMemo(() => rows.map((r) => ({ ...r, status_for_dashboard: r.status })), [rows]);

  const activeProductSectionMeta = useMemo(
    () => PATIENT_PRODUCT_HUB_SECTIONS.find((s) => s.id === activeProductSection) ?? null,
    [activeProductSection]
  );

  const filteredSorted = useMemo(() => {
    let list = rowsWithDashboardStatus;
    if (isProductHub) {
      list = filterPatientProductHubListRows(list, {
        bucketStatuses: activeBucket?.statuses ?? null,
        sectionId: activeProductSection,
      });
    } else if (activeBucket) {
      const allow = new Set(activeBucket.statuses);
      list = list.filter((r) => allow.has((r as { status_for_dashboard?: string }).status_for_dashboard ?? r.status));
    }
    if (pharmacyFilter) list = list.filter((r) => r.pharmacy_id === pharmacyFilter);
    if (refQuery.trim().length >= 2) {
      const ph = (row: (typeof rows)[number]) => one(row.pharmacies);
      list = list.filter((r) => {
        const p = ph(r);
        return rowMatchesPublicRefQuery(refQuery, [
          r.request_public_ref,
          p?.public_ref,
          p?.nom,
          p?.ville,
          formatShortId(r.id),
        ]);
      });
    }
    return [...list].sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      return sortNewestFirst ? tb - ta : ta - tb;
    });
  }, [rowsWithDashboardStatus, activeBucket, activeProductSection, pharmacyFilter, refQuery, sortNewestFirst, isProductHub]);

  const pharmacyFilterLabel = useMemo(
    () => pharmacyOptions.find(([id]) => id === pharmacyFilter)?.[1] ?? null,
    [pharmacyOptions, pharmacyFilter]
  );

  const listFiltersSummary = useMemo(
    () =>
      patientHubListActiveFiltersSummary({
        activeBucket,
        activeSection: activeProductSectionMeta,
        pharmacyLabel: pharmacyFilterLabel,
        referenceQuery: refQuery,
        sortNewestFirst,
      }),
    [activeBucket, activeProductSectionMeta, pharmacyFilterLabel, refQuery, sortNewestFirst]
  );

  const listHasActiveFilters = useMemo(
    () =>
      patientHubListHasActiveFilters({
        activeBucket,
        activeSection: activeProductSectionMeta,
        pharmacyLabel: pharmacyFilterLabel,
        referenceQuery: refQuery,
        sortNewestFirst,
      }),
    [activeBucket, activeProductSectionMeta, pharmacyFilterLabel, refQuery, sortNewestFirst]
  );

  const clearListFilters = () => {
    setPharmacyFilter("");
    setRefQuery("");
    setSortNewestFirst(true);
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    next.delete("statut");
    next.delete("section");
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const setStatutFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (key === "") next.delete("statut");
    else next.set("statut", key);
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const setProductSectionFilter = (sectionId: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (sectionId === "") next.delete("section");
    else next.set("section", sectionId);
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const linkClass =
    accent === "amber" ? "text-amber-900 underline" : accent === "violet" ? "text-violet-900 underline" : "text-sky-800 underline";
  const filterShell =
    accent === "amber"
      ? "rounded-xl border-2 border-amber-100 bg-amber-50/50 p-3 shadow-sm"
      : accent === "violet"
        ? "rounded-xl border-2 border-violet-100 bg-violet-50/50 p-3 shadow-sm"
        : "rounded-xl border-2 border-sky-100 bg-sky-50/50 p-3 shadow-sm";
  const filterTitle =
    accent === "amber" ? "text-amber-950" : accent === "violet" ? "text-violet-950" : "text-sky-950";
  const filterBtn =
    accent === "amber"
      ? "rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-900 shadow-sm hover:bg-amber-50"
      : accent === "violet"
        ? "rounded-md border border-violet-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-violet-900 shadow-sm hover:bg-violet-50"
        : "rounded-md border border-sky-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-sky-900 shadow-sm hover:bg-sky-50";

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
        <Link href="/" className={clsx("text-xs font-medium", linkClass)}>
          ← Annuaire
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  const emptyHint =
    kindId === "prescription"
      ? "Annuaire → pharmacie → envoyer une ordonnance."
      : kindId === "free_consultation"
        ? "Annuaire → pharmacie → consultation libre."
        : "Annuaire → pharmacie → demande de produits.";

  return (
    <PageShell
      maxWidthClass="max-w-3xl"
      className={clsx("space-y-4", isProductHub && "bg-gradient-to-b from-sky-50/40 via-slate-50 to-slate-50")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/"
            className={clsx("text-xs font-medium", isProductHub ? productTheme.backLink : linkClass)}
          >
            ← Annuaire
          </Link>
          <h1 className="mt-2 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {kindConfig.copy.patientHubTitle}
          </h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
            {kindId === "prescription"
              ? "Suivi de vos ordonnances envoyées aux pharmacies."
              : kindId === "free_consultation"
                ? "Suivi de vos consultations libres : message, échange et proposition produits."
                : "Vos demandes de produits, classées par ce qui vous concerne, ce qui est chez l’officine et les archives."}
          </p>
        </div>
        <Link
          href="/dashboard/notifications"
          className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted/50"
        >
          Notifications
        </Link>
      </div>

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

      {tab === "dashboard" ? (
        <>
          {rows.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center sm:p-8">
              <p className="text-sm font-medium text-foreground">
                {kindId === "prescription"
                  ? "Aucune ordonnance"
                  : kindId === "free_consultation"
                    ? "Aucune consultation"
                    : "Aucune demande"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{emptyHint}</p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95"
              >
                Annuaire
              </Link>
            </div>
          ) : (
            <div className="mt-4">
              {isProductHub ? (
                <PatientProductDemandesDashboard rows={rows} basePath={hubPath} unreadById={unreadById} />
              ) : (
                <DemandeStatDashboard
                  rows={rowsWithDashboardStatus}
                  buckets={dashboardBuckets}
                  basePath={hubPath}
                  dashboardTitle={dashboardChrome.title}
                  dashboardSubtitle={dashboardChrome.subtitle}
                />
              )}
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <section
            className={clsx(
              "relative overflow-hidden rounded-2xl border shadow-md",
              isProductHub
                ? "border-slate-300/90 bg-gradient-to-br from-white via-slate-50/95 to-slate-100/80 ring-1 ring-slate-900/[0.06]"
                : filterShell
            )}
          >
            {isProductHub ? (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-indigo-500 via-violet-500 to-slate-400"
                aria-hidden
              />
            ) : null}
            <div className={clsx("p-3.5 sm:p-4", isProductHub && "pl-4 sm:pl-5")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={clsx(
                      "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm",
                      isProductHub
                        ? "bg-slate-900 text-white"
                        : accent === "amber"
                          ? "bg-amber-600 text-white"
                          : accent === "violet"
                            ? "bg-violet-600 text-white"
                            : "bg-sky-700 text-white"
                    )}
                  >
                    <SlidersHorizontal className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className={clsx(
                        "text-sm font-bold tracking-tight",
                        isProductHub ? "text-slate-900" : filterTitle
                      )}
                    >
                      Recherche et filtres
                    </h2>
                    <p
                      className={clsx(
                        "mt-0.5 text-[11px] leading-snug",
                        isProductHub ? "text-slate-600" : "text-muted-foreground"
                      )}
                    >
                      Uniquement pour cette liste — le tableau de bord reste inchangé.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen((v) => !v)}
                  className={clsx(
                    "shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-sm transition",
                    isProductHub
                      ? "border border-slate-300/90 bg-white text-slate-800 hover:bg-slate-50"
                      : filterBtn
                  )}
                >
                  {filtersOpen ? "Réduire" : "Ouvrir"}
                </button>
              </div>

              {filtersOpen ? (
                <div
                  className={clsx(
                    "mt-3 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4",
                    isProductHub && "rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-inner"
                  )}
                >
                  <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      Référence dossier
                    </span>
                    <span className="relative block">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        value={refQuery}
                        onChange={(e) => setRefQuery(e.target.value)}
                        placeholder={refPlaceholder}
                        className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-2.5 text-xs text-foreground shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
                      />
                    </span>
                  </label>
                  {isProductHub ? (
                    <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Regroupement</span>
                      <select
                        value={activeProductSection ?? ""}
                        onChange={(e) => setProductSectionFilter(e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-foreground shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
                      >
                        <option value="">Tous les regroupements</option>
                        {PATIENT_PRODUCT_HUB_SECTIONS.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Statut</span>
                    <select
                      value={activeBucket?.key ?? ""}
                      onChange={(e) => setStatutFilter(e.target.value)}
                      className={clsx(
                        "rounded-lg border bg-white px-2.5 py-2 text-xs text-foreground shadow-sm focus:outline-none focus:ring-2",
                        isProductHub
                          ? "border-slate-200 focus:border-indigo-400 focus:ring-indigo-200/60"
                          : "border-input"
                      )}
                    >
                      <option value="">Tous les statuts</option>
                      {dashboardBuckets.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Pharmacie</span>
                    <select
                      value={pharmacyFilter}
                      onChange={(e) => setPharmacyFilter(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-foreground shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
                    >
                      <option value="">Toutes</option>
                      {pharmacyOptions.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tri</span>
                    <select
                      value={sortNewestFirst ? "desc" : "asc"}
                      onChange={(e) => setSortNewestFirst(e.target.value === "desc")}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-foreground shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200/60"
                    >
                      <option value="desc">Plus récentes d’abord</option>
                      <option value="asc">Plus anciennes d’abord</option>
                    </select>
                  </label>
                </div>
              ) : listHasActiveFilters ? (
                <div
                  className={clsx(
                    "mt-3 rounded-xl border px-3 py-2.5 text-[11px] leading-snug",
                    isProductHub
                      ? "border-indigo-200/70 bg-indigo-50/50 text-slate-800"
                      : accent === "amber"
                        ? "border-amber-200/80 bg-amber-50/60 text-amber-950"
                        : accent === "violet"
                          ? "border-violet-200/80 bg-violet-50/60 text-violet-950"
                          : "border-sky-200/80 bg-sky-50/60 text-sky-950"
                  )}
                >
                  <p>
                    <span className="font-semibold">Filtres actifs (liste) :</span> {listFiltersSummary}
                  </p>
                  <button
                    type="button"
                    onClick={clearListFilters}
                    className={clsx(
                      "mt-1.5 text-[11px] font-semibold underline underline-offset-2",
                      isProductHub ? "text-indigo-800" : linkClass
                    )}
                  >
                    Tout effacer
                  </button>
                </div>
              ) : (
                <p className={clsx("mt-3 text-[11px] leading-snug", isProductHub ? "text-slate-600" : "text-muted-foreground")}>
                  Référence, regroupement, statut, pharmacie ou tri — sans modifier le tableau de bord.
                </p>
              )}
            </div>
          </section>

          {filteredSorted.length === 0 ? (
            <div className="space-y-2 py-6 text-center text-xs text-muted-foreground">
              <p>
                {activeBucket?.key === "envoyees"
                  ? kindId === "prescription"
                    ? "Aucune ordonnance en attente de réponse avec ces filtres."
                    : kindId === "free_consultation"
                      ? "Aucune consultation en attente de réponse avec ces filtres."
                      : "Aucune demande en attente de réponse pharmacie avec ces filtres."
                  : activeProductSectionMeta && activeBucket
                    ? `Aucune demande pour « ${activeProductSectionMeta.title} » au statut « ${activeBucket.label} ». Essayez un seul filtre à la fois.`
                    : activeProductSectionMeta
                      ? `Aucune demande dans « ${activeProductSectionMeta.title} » avec ces filtres.`
                      : activeBucket
                        ? `Aucune demande au statut « ${activeBucket.label} » avec ces filtres.`
                        : listHasActiveFilters
                          ? "Aucun résultat avec ces filtres."
                          : "Aucun résultat."}
              </p>
              {listHasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearListFilters}
                  className={clsx("font-semibold underline", isProductHub ? productTheme.backLink : linkClass)}
                >
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {filteredSorted.map((r) => (
                <li key={r.id}>
                  {isProductHub ? (
                    <PatientProductDemandeHubCard row={r} conversationUnread={unreadById[r.id] === true} />
                  ) : (
                    <PatientDemandeCard row={r} variant="list" conversationUnread={unreadById[r.id] === true} />
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

export function PatientDemandesHub() {
  return <PatientRequestKindHub kindId="product_request" />;
}
