"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PatientWorkflowHubHeader } from "@/components/patient/patient-workflow-hub-header";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";
import { RequestParcoursTabBar } from "@/components/requests/hub/request-parcours-tab-bar";
import { type HubTab, type PatientRequestRow } from "@/components/requests/demande-hub-ui";
import { PatientProductDemandeHubCard } from "@/components/requests/product/patient-product-demande-hub-card";
import { filterPatientProductHubListRows } from "@/lib/patient-product-hub-sections";
import {
  patientHubListActiveFiltersSummary,
  patientHubListHasActiveFilters,
} from "@/lib/patient-request-hub-list-filters";
import {
  hubListFilterChrome as filterChrome,
  hubListFiltersPanelExpanded,
  hubListHasManualFilters,
} from "@/lib/hub-list-filter-chrome";
import { patientHubDashboardAccent } from "@/lib/patient-workflow-hub-dashboard-ui";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam, isPatientArchiveBucketKey, patientRequestActiveStatuses } from "@/lib/demandes-hub-buckets";
import { one } from "@/lib/embed";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { pharmacyCityLabel, pharmacyCitySearchTerms } from "@/lib/pharmacy-cities-morocco";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { collatorForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { REQUEST_ITEMS_HUB_SUMMARY_EMBED_SELECT } from "@/lib/request-line-product-embed";
import { PatientHubCatalogPriceVisibilityProvider } from "@/lib/patient-hub-catalog-price-visibility-context";
import { fetchCatalogPriceVisibilityByPharmacyIds } from "@/lib/pharmacy-pricing/fetch-catalog-price-visibility-map";
import {
  ALL_REQUEST_KIND_IDS,
  buildHubUrl,
  countActiveRequestsByParcours,
  effectiveKindIdForHub,
  filterRowsByParcours,
  parseParcoursParam,
  type RequestHubParcoursSlug,
  UNIFIED_PATIENT_HUB_PATH,
} from "@/lib/request-hub-parcours";
import { supabase } from "@/lib/supabase";
import { REQUEST_CONVERSATION_READ_EVENT, type RequestConversationReadDetail } from "@/lib/request-detail-refresh-bus";
import { uiActionBtnFilterToggle } from "@/lib/ui-action-buttons";

function tabFromSearch(v: string | null): HubTab {
  return v === "dashboard" ? "dashboard" : "list";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

function listTabLabelForParcours(
  parcours: RequestHubParcoursSlug,
  tHub: ReturnType<typeof useTranslations<"hub">>,
): string {
  if (parcours === "ordonnances") return tHub("dashboard.allPrescriptions");
  if (parcours === "consultations") return tHub("dashboard.allConsultations");
  return tHub("dashboard.allRequests");
}

function emptyCopyForParcours(
  parcours: RequestHubParcoursSlug,
  tList: ReturnType<typeof useTranslations<"hub.listChrome">>,
): { title: string; hint: string } {
  if (parcours === "ordonnances") {
    return { title: tList("noPrescriptions"), hint: tList("emptyHintPrescription") };
  }
  if (parcours === "consultations") {
    return { title: tList("noConsultations"), hint: tList("emptyHintConsultation") };
  }
  if (parcours === "produits") {
    return { title: tList("noRequests"), hint: tList("emptyHintProduct") };
  }
  return {
    title: tList("noRequests"),
    hint: "Annuaire → pharmacie → demande de produits, ordonnance ou consultation.",
  };
}

export function PatientUnifiedRequestsHub() {
  const tHub = useTranslations("hub");
  const tUnified = useTranslations("hub.unifiedHub");
  const tList = useTranslations("hub.listChrome");
  const tCommon = useTranslations("common");
  const tDemandes = useTranslations("demandes");
  const locale = useLocale() as AppLocale;
  const hubPath = UNIFIED_PATIENT_HUB_PATH;

  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("vue"));
  const parcours = parseParcoursParam(searchParams.get("parcours"));
  const effectiveKindId = effectiveKindIdForHub(parcours);

  const replaceHubUrl = (params: Parameters<typeof buildHubUrl>[1]) => {
    router.replace(buildHubUrl(hubPath, params, searchParams), { scroll: false });
  };

  const setTab = (t: HubTab) => {
    replaceHubUrl({
      vue: tabToSearch(t),
      statut: t === "dashboard" ? null : undefined,
      section: t === "dashboard" ? null : undefined,
    });
    if (t === "dashboard") setFiltersExpandedUser(null);
  };

  const setParcours = (nextParcours: RequestHubParcoursSlug) => {
    replaceHubUrl({ parcours: nextParcours });
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PatientRequestRow[]>([]);
  const [catalogPriceVisibilityByPharmacyId, setCatalogPriceVisibilityByPharmacyId] = useState<
    Record<string, boolean>
  >({});
  const [unreadById, setUnreadById] = useState<Record<string, boolean>>({});
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const dashboardBuckets = useMemo(
    () => dashboardBucketsForKind(effectiveKindId, "patient"),
    [effectiveKindId],
  );

  const listStatutParam = tab === "list" ? searchParams.get("statut") : null;
  const activeBucket = bucketForStatusParam(listStatutParam, dashboardBuckets);

  const parcoursCounts = useMemo(() => countActiveRequestsByParcours(rows, "patient"), [rows]);
  const displayRows = useMemo(() => filterRowsByParcours(rows, parcours), [rows, parcours]);

  const preserveSearchParams = useMemo(() => {
    if (parcours === "tous") return undefined;
    return { parcours };
  }, [parcours]);

  useEffect(() => {
    if (tab !== "dashboard") return;
    const hasListOnlyParams = searchParams.has("statut") || searchParams.has("section");
    if (!hasListOnlyParams) return;
    replaceHubUrl({ statut: null, section: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync URL when leaving list-only params on dashboard tab
  }, [tab, searchParams]);

  useEffect(() => {
    if (searchParams.get("filtres") !== "0") return;
    replaceHubUrl({ filtres: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot cleanup of filtres=0
  }, [searchParams]);

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
          setError(tList("patientsOnly"));
          setLoading(false);
        }
        return;
      }

      const { data, error: re } = await supabase
        .from("requests")
        .select(
          "id,created_at,updated_at,status,request_type,pharmacy_id,submitted_at,responded_at,request_public_ref,pharmacies(nom,nom_ar,ville,public_ref)," +
            `request_items(${REQUEST_ITEMS_HUB_SUMMARY_EMBED_SELECT})`,
        )
        .eq("patient_id", user.id)
        .in("request_type", ALL_REQUEST_KIND_IDS)
        .order("created_at", { ascending: false })
        .limit(200);

      if (cancelled) return;

      if (re) {
        setError(re.message);
        setUnreadById({});
      } else if (Array.isArray(data)) {
        const typed = data as unknown as PatientRequestRow[];
        setRows(typed);
        const pharmacyIds = [...new Set(typed.map((r) => r.pharmacy_id).filter(Boolean))];
        if (pharmacyIds.length > 0) {
          void fetchCatalogPriceVisibilityByPharmacyIds(supabase, pharmacyIds).then((map) => {
            if (!cancelled) setCatalogPriceVisibilityByPharmacyId(map);
          });
        } else if (!cancelled) {
          setCatalogPriceVisibilityByPharmacyId({});
        }
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
  }, [router, hubPath, tList]);

  useEffect(() => {
    const onConversationRead = (event: Event) => {
      const requestId = (event as CustomEvent<RequestConversationReadDetail>).detail?.requestId;
      if (!requestId) return;
      setUnreadById((prev) => {
        if (!prev[requestId]) return prev;
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
    };

    window.addEventListener(REQUEST_CONVERSATION_READ_EVENT, onConversationRead);
    return () => window.removeEventListener(REQUEST_CONVERSATION_READ_EVENT, onConversationRead);
  }, []);

  const pharmacyOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of displayRows) {
      if (m.has(r.pharmacy_id)) continue;
      const ph = one(r.pharmacies);
      m.set(
        r.pharmacy_id,
        ph?.nom
          ? `${pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar })}${
              ph.ville ? ` (${pharmacyCityLabel(ph.ville, locale)})` : ""
            }`
          : `${tDemandes("pharmacyFallback")} ${r.pharmacy_id.slice(0, 8)}…`,
      );
    }
    return [...m.entries()].sort((a, b) => collatorForLocale(locale).compare(a[1], b[1]));
  }, [displayRows, locale, tDemandes]);

  const rowsWithDashboardStatus = useMemo(
    () => displayRows.map((r) => ({ ...r, status_for_dashboard: r.status })),
    [displayRows],
  );

  const pharmacyFilterLabel = pharmacyOptions.find(([id]) => id === pharmacyFilter)?.[1] ?? null;

  let filteredList = filterPatientProductHubListRows(rowsWithDashboardStatus, {
    bucketStatuses: activeBucket?.statuses ?? null,
  });
  const applyActiveOnly = activeOnly && !(activeBucket && isPatientArchiveBucketKey(activeBucket.key));
  if (applyActiveOnly) {
    const activeStatuses = new Set(patientRequestActiveStatuses());
    filteredList = filteredList.filter((r) => activeStatuses.has(r.status));
  }
  if (pharmacyFilter) filteredList = filteredList.filter((r) => r.pharmacy_id === pharmacyFilter);
  if (refQuery.trim().length >= 2) {
    filteredList = filteredList.filter((r) => {
      const p = one(r.pharmacies);
      return rowMatchesPublicRefQuery(refQuery, [
        r.request_public_ref,
        p?.public_ref,
        p?.nom,
        p?.nom_ar,
        ...pharmacyCitySearchTerms(p?.ville),
        formatShortId(r.id),
      ]);
    });
  }
  const filteredSorted = [...filteredList].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortNewestFirst ? tb - ta : ta - tb;
  });

  const listFiltersSummary = patientHubListActiveFiltersSummary({
    activeBucket,
    pharmacyLabel: pharmacyFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    activeOnly,
    includeArchivesLabel: tList("includeArchives"),
  });

  const listHasActiveFilters = patientHubListHasActiveFilters({
    activeBucket,
    pharmacyLabel: pharmacyFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    activeOnly,
  });

  const hasManualListFilters = hubListHasManualFilters({
    entityFilter: pharmacyFilter,
    referenceQuery: refQuery,
    sortNewestFirst,
  });
  const filtersPanelExpanded = hubListFiltersPanelExpanded({
    tabIsList: tab === "list",
    listStatutParam,
    hasManualFilters: hasManualListFilters,
    filtersExpandedUser,
  });

  const clearListFilters = () => {
    setPharmacyFilter("");
    setRefQuery("");
    setSortNewestFirst(true);
    setActiveOnly(true);
    setFiltersExpandedUser(null);
    replaceHubUrl({ vue: "liste", statut: null, section: null });
  };

  const setStatutFilter = (key: string) => {
    replaceHubUrl({ vue: "liste", statut: key || null });
  };

  const hubAccent = patientHubDashboardAccent(effectiveKindId, "patient") ?? "sky";
  const listTabLabel = listTabLabelForParcours(parcours, tHub);
  const emptyCopy = emptyCopyForParcours(parcours, tList);
  const filterBtn = uiActionBtnFilterToggle();
  const showParcoursLabel = parcours === "tous";

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </PageShell>
    );
  }

  if (error && rows.length === 0) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <Link href="/" className="text-xs font-medium text-primary underline underline-offset-2">
          ← Annuaire
        </Link>
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PatientHubCatalogPriceVisibilityProvider visibilityByPharmacyId={catalogPriceVisibilityByPharmacyId}>
      <PageShell maxWidthClass="max-w-3xl" className="space-y-3">
        <RequestParcoursTabBar active={parcours} counts={parcoursCounts} onChange={setParcours} />

        <PatientWorkflowHubHeader
          title={tUnified("patientTitle")}
          accent={hubAccent}
          tab={tab}
          onTab={setTab}
          tabLabels={{
            dashboard: tList("dashboardTab"),
            list: listTabLabel,
          }}
        />

        {tab === "dashboard" ? (
          <>
            {displayRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center sm:p-8">
                <p className="text-sm font-medium text-foreground">{emptyCopy.title}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{emptyCopy.hint}</p>
                <Link
                  href="/"
                  className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-95"
                >
                  {tList("directory")}
                </Link>
              </div>
            ) : (
              <RequestKindHubDashboard
                kindId={effectiveKindId}
                role="patient"
                rows={displayRows}
                basePath={hubPath}
                unreadById={unreadById}
                preserveSearchParams={preserveSearchParams}
              />
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded border-input"
                />
                {tList("activeOnly")}
              </label>
              <button
                type="button"
                onClick={() => setFiltersExpandedUser(!filtersPanelExpanded)}
                className={filterBtn}
              >
                {filtersPanelExpanded ? tList("hideFilters") : tList("filters")}
              </button>
            </div>

            {listHasActiveFilters && !filtersPanelExpanded ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] leading-snug text-foreground">
                <p>
                  <span className="font-semibold">{tList("activeFilters")}</span> {listFiltersSummary}
                </p>
                <button type="button" onClick={clearListFilters} className={clsx("mt-1.5", filterChrome.clearLink)}>
                  {tList("clearAll")}
                </button>
              </div>
            ) : null}

            {filtersPanelExpanded ? (
              <section className={filterChrome.shell}>
                <div className="grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
                  <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {tList("dossierRef")}
                    </span>
                    <span className="relative block">
                      <Search
                        className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
                        aria-hidden
                      />
                      <input
                        value={refQuery}
                        onChange={(e) => setRefQuery(e.target.value)}
                        placeholder="Ex. D042/26, O042/26…"
                        className="w-full rounded-lg border border-input bg-background py-2 ps-8 pe-2.5 text-xs text-foreground shadow-sm placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                    </span>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {tList("status")}
                    </span>
                    <select
                      value={activeBucket?.key ?? ""}
                      onChange={(e) => setStatutFilter(e.target.value)}
                      className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                    >
                      <option value="">{tList("allStatuses")}</option>
                      {dashboardBuckets.map((b) => (
                        <option key={b.key} value={b.key}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {tList("pharmacy")}
                    </span>
                    <select
                      value={pharmacyFilter}
                      onChange={(e) => setPharmacyFilter(e.target.value)}
                      className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                    >
                      <option value="">{tList("allPharmacies")}</option>
                      {pharmacyOptions.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {tList("sort")}
                    </span>
                    <select
                      value={sortNewestFirst ? "desc" : "asc"}
                      onChange={(e) => setSortNewestFirst(e.target.value === "desc")}
                      className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                    >
                      <option value="desc">{tList("sortNewest")}</option>
                      <option value="asc">{tList("sortOldest")}</option>
                    </select>
                  </label>
                </div>
              </section>
            ) : null}

            {filteredSorted.length === 0 ? (
              <div className="space-y-2 py-6 text-center text-xs text-muted-foreground">
                <p>{tList("noResults")}</p>
                {listHasActiveFilters ? (
                  <button type="button" onClick={clearListFilters} className={filterChrome.clearLink}>
                    {tList("clearFilters")}
                  </button>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {filteredSorted.map((r) => (
                  <li key={r.id}>
                    <PatientProductDemandeHubCard
                      row={r}
                      conversationUnread={unreadById[r.id] === true}
                      showParcoursLabel={showParcoursLabel}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </PageShell>
    </PatientHubCatalogPriceVisibilityProvider>
  );
}

/** @deprecated Utiliser `PatientUnifiedRequestsHub`. */
export function PatientRequestKindHub(_props: { kindId: RequestKindId }) {
  return <PatientUnifiedRequestsHub />;
}

export function PatientDemandesHub() {
  return <PatientUnifiedRequestsHub />;
}
