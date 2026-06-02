"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search, SlidersHorizontal } from "lucide-react";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PatientDemandeCard,
  type PatientRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PatientProductDemandeHubCard } from "@/components/requests/product/patient-product-demande-hub-card";
import { ProductHubListResultsBar } from "@/components/requests/product/product-hub-list-results-bar";
import { filterPatientProductHubListRows } from "@/lib/patient-product-hub-sections";
import {
  patientHubListActiveFiltersSummary,
  patientHubListHasActiveFilters,
} from "@/lib/patient-request-hub-list-filters";
import { hubListFilterChrome as filterChrome } from "@/lib/hub-list-filter-chrome";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { one } from "@/lib/embed";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";
import { uiActionBtnFilterToggle } from "@/lib/ui-action-buttons";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PatientRequestKindHub({ kindId }: { kindId: RequestKindId }) {
  const kindConfig = getRequestKindConfig(kindId);
  const hubPath = kindConfig.routes.patientHubPath;
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
      setFiltersExpandedUser(null);
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
  /** `null` = ouverture auto si filtres URL ou actifs sur la liste. */
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const isProductHub = kindId === "product_request";
  const dashboardBuckets = useMemo(() => dashboardBucketsForKind(kindId, "patient"), [kindId]);

  /** Filtres URL : réservés à l’onglet liste — le tableau de bord reste toujours complet. */
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

  useEffect(() => {
    let cancelled = false;

    async function loadHubRows() {
      setError("");
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        router.replace(`/auth?redirect=${encodeURIComponent(hubPath)}`);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if ((profile as { role?: string } | null)?.role !== "patient") {
        if (!cancelled) {
          setError("Cet espace est réservé aux patients.");
          setLoading(false);
        }
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

      if (cancelled) return;

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
    }

    const tid = window.setTimeout(() => void loadHubRows(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [router, hubPath, kindId]);

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

  const filteredSorted = useMemo(() => {
    let list = rowsWithDashboardStatus;
    if (isProductHub) {
      list = filterPatientProductHubListRows(list, {
        bucketStatuses: activeBucket?.statuses ?? null,
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
  }, [rowsWithDashboardStatus, activeBucket, pharmacyFilter, refQuery, sortNewestFirst, isProductHub]);

  const pharmacyFilterLabel = useMemo(
    () => pharmacyOptions.find(([id]) => id === pharmacyFilter)?.[1] ?? null,
    [pharmacyOptions, pharmacyFilter]
  );

  const listFiltersSummary = useMemo(
    () =>
      patientHubListActiveFiltersSummary({
        activeBucket,
        pharmacyLabel: pharmacyFilterLabel,
        referenceQuery: refQuery,
        sortNewestFirst,
      }),
    [activeBucket, pharmacyFilterLabel, refQuery, sortNewestFirst]
  );

  const listHasActiveFilters = useMemo(
    () =>
      patientHubListHasActiveFilters({
        activeBucket,
        pharmacyLabel: pharmacyFilterLabel,
        referenceQuery: refQuery,
        sortNewestFirst,
      }),
    [activeBucket, pharmacyFilterLabel, refQuery, sortNewestFirst]
  );

  const filtersAutoExpand = tab === "list" && (Boolean(listStatutParam) || listHasActiveFilters);
  const filtersPanelExpanded = filtersExpandedUser ?? filtersAutoExpand;

  const clearListFilters = () => {
    setPharmacyFilter("");
    setRefQuery("");
    setSortNewestFirst(true);
    setFiltersExpandedUser(null);
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

  const filterBtn = uiActionBtnFilterToggle();
  const hubSubtitle =
    kindId === "prescription"
      ? "Suivi de vos ordonnances envoyées aux pharmacies."
      : kindId === "free_consultation"
        ? "Suivi de vos consultations libres : message, échange et proposition produits."
        : "8 statuts en tête, reprise rapide et liste filtrable par statut, pharmacie ou référence.";

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
        <Link href="/" className={p.backLink}>
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
      className="space-y-4"
    >
      <PatientAccountPageHeader
        eyebrow="Mes dossiers"
        title={kindConfig.copy.patientHubTitle}
        subtitle={hubSubtitle}
        trailing={
          <Link href="/dashboard/notifications" className={p.headerAction}>
            Notifications
          </Link>
        }
      />

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
              <RequestKindHubDashboard
                kindId={kindId}
                role="patient"
                rows={rows}
                basePath={hubPath}
                unreadById={unreadById}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-4">
          <section className={filterChrome.shell}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className={filterChrome.iconBox}>
                  <SlidersHorizontal className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h2 className={filterChrome.title}>Recherche et filtres</h2>
                  <p className={filterChrome.subtitle}>
                    Uniquement pour cette liste — le tableau de bord reste inchangé.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFiltersExpandedUser(!(filtersExpandedUser ?? filtersAutoExpand))}
                className={filterBtn}
              >
                {filtersPanelExpanded ? "Réduire" : "Ouvrir"}
              </button>
            </div>

            {filtersPanelExpanded ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Référence dossier
                  </span>
                  <span className="relative block">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
                      aria-hidden
                    />
                    <input
                      value={refQuery}
                      onChange={(e) => setRefQuery(e.target.value)}
                      placeholder={refPlaceholder}
                      className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2.5 text-xs text-foreground shadow-sm placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                  </span>
                </label>
                <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Statut</span>
                  <select
                    value={activeBucket?.key ?? ""}
                    onChange={(e) => setStatutFilter(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
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
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pharmacie</span>
                  <select
                    value={pharmacyFilter}
                    onChange={(e) => setPharmacyFilter(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
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
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Tri</span>
                  <select
                    value={sortNewestFirst ? "desc" : "asc"}
                    onChange={(e) => setSortNewestFirst(e.target.value === "desc")}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                  >
                    <option value="desc">Plus récentes d’abord</option>
                    <option value="asc">Plus anciennes d’abord</option>
                  </select>
                </label>
              </div>
            ) : listHasActiveFilters ? (
              <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-[11px] leading-snug text-foreground">
                <p>
                  <span className="font-semibold">Filtres actifs (liste) :</span> {listFiltersSummary}
                </p>
                <button
                  type="button"
                  onClick={clearListFilters}
                  className={clsx("mt-1.5", filterChrome.clearLink)}
                >
                  Tout effacer
                </button>
              </div>
            ) : (
              <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                Référence, statut, pharmacie ou tri — sans modifier le tableau de bord.
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
            <div className="space-y-2 py-6 text-center text-xs text-muted-foreground">
              <p>
                {activeBucket?.key === "envoyees"
                  ? kindId === "prescription"
                    ? "Aucune ordonnance en attente de réponse avec ces filtres."
                    : kindId === "free_consultation"
                      ? "Aucune consultation en attente de réponse avec ces filtres."
                      : "Aucune demande en attente de réponse pharmacie avec ces filtres."
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
                  className={filterChrome.clearLink}
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
