"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";
import {
  HubListScopeCount,
  parcoursToWorkflowAccent,
  RequestUnifiedHubChrome,
} from "@/components/requests/hub/request-unified-hub-chrome";
import {
  type HubTab,
  type PharmacistRequestRow,
} from "@/components/requests/demande-hub-ui";
import { PharmacistProductDemandeHubCard } from "@/components/requests/product/pharmacist-product-demande-hub-card";
import { filterPharmacistProductHubListRows } from "@/lib/pharmacist-product-hub-sections";
import {
  pharmacistHubListActiveFiltersSummary,
  pharmacistHubListHasActiveFilters,
} from "@/lib/pharmacist-request-hub-list-filters";
import {
  hubListFilterChrome as filterChrome,
  hubListFiltersPanelExpanded,
  hubListHasManualFilters,
} from "@/lib/hub-list-filter-chrome";
import { PageShell } from "@/components/ui/compact-shell";
import {
  bucketForStatusParam,
  isPharmacistArchiveBucketKey,
  pharmacistRequestActiveStatuses,
} from "@/lib/demandes-hub-buckets";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { REQUEST_ITEMS_HUB_SUMMARY_EMBED_SELECT } from "@/lib/request-line-product-embed";
import {
  ALL_REQUEST_KIND_IDS,
  buildHubUrl,
  countActiveRequestsByParcours,
  effectiveKindIdForHub,
  excludePharmacistPrescriptionDrafts,
  filterRowsByParcours,
  parseParcoursParam,
  type RequestHubParcoursSlug,
  unifiedHubTitleKey,
  UNIFIED_PHARMACIST_HUB_PATH,
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

function listTabLabelForParcours(parcours: RequestHubParcoursSlug): string {
  if (parcours === "ordonnances") return "Toutes les ordonnances";
  if (parcours === "consultations") return "Toutes les consultations";
  return "Toutes les demandes";
}

function emptyCopyForParcours(parcours: RequestHubParcoursSlug): { title: string; hint: string } {
  if (parcours === "ordonnances") {
    return {
      title: "Aucune ordonnance",
      hint: "Les ordonnances envoyées par vos patients apparaîtront ici.",
    };
  }
  if (parcours === "consultations") {
    return {
      title: "Aucune consultation",
      hint: "Les consultations libres envoyées par vos patients apparaîtront ici.",
    };
  }
  if (parcours === "produits") {
    return { title: "Aucune demande", hint: "Les dossiers patients apparaîtront ici." };
  }
  return {
    title: "Aucune demande",
    hint: "Les demandes produits, ordonnances et consultations apparaîtront ici.",
  };
}

export function PharmacistUnifiedRequestsHub() {
  const tList = useTranslations("hub.listChrome");
  const tUnified = useTranslations("hub.unifiedHub");
  const hubPath = UNIFIED_PHARMACIST_HUB_PATH;

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
  const [rows, setRows] = useState<PharmacistRequestRow[]>([]);
  const [unreadById, setUnreadById] = useState<Record<string, boolean>>({});
  const [patientFilter, setPatientFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [activeOnly, setActiveOnly] = useState(true);
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const dashboardBuckets = useMemo(
    () => dashboardBucketsForKind(effectiveKindId, "pharmacien"),
    [effectiveKindId],
  );

  const listStatutParam = tab === "list" ? searchParams.get("statut") : null;
  const activeBucket = bucketForStatusParam(listStatutParam, dashboardBuckets);

  const parcoursCounts = useMemo(() => countActiveRequestsByParcours(rows, "pharmacien"), [rows]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, searchParams]);

  useEffect(() => {
    if (searchParams.get("filtres") !== "0") return;
    replaceHubUrl({ filtres: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (pe || !profile || (profile as { role: string }).role !== "pharmacien") {
        if (!cancelled) {
          setError("Accès réservé aux comptes pharmacien.");
          setLoading(false);
        }
        return;
      }

      const { data: staff, error: se } = await supabase
        .from("pharmacy_staff")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (se || !staff?.pharmacy_id) {
        if (!cancelled) {
          setError("Aucune pharmacie rattachée à ton compte (pharmacy_staff).");
          setLoading(false);
        }
        return;
      }

      const { data, error: re } = await supabase
        .from("requests")
        .select(
          `id,created_at,updated_at,status,request_type,patient_id,submitted_at,responded_at,request_public_ref,request_items(${REQUEST_ITEMS_HUB_SUMMARY_EMBED_SELECT})`,
        )
        .eq("pharmacy_id", staff.pharmacy_id)
        .in("request_type", ALL_REQUEST_KIND_IDS)
        .order("created_at", { ascending: false })
        .limit(220);

      if (cancelled) return;

      if (re) {
        setError(re.message);
        setUnreadById({});
        setLoading(false);
        return;
      }

      const raw = excludePharmacistPrescriptionDrafts((data ?? []) as unknown as PharmacistRequestRow[]);
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
          const patient = map.get(r.patient_id);
          return {
            ...r,
            patient_full_name: patient?.full_name ?? null,
            patient_whatsapp: patient?.whatsapp ?? null,
            patient_ref: patient?.patient_ref ?? null,
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
    }

    const tid = window.setTimeout(() => void loadHubRows(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [router, hubPath]);

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

  const patientOptions = useMemo(() => [...new Set(displayRows.map((r) => r.patient_id))].sort(), [displayRows]);

  const patientSelectLabel = useCallback(
    (pid: string) => {
      const row = displayRows.find((r) => r.patient_id === pid);
      const name = row?.patient_full_name?.trim();
      const pref = row?.patient_ref?.trim();
      const tag = pref ? pref : `#${formatShortId(pid)}`;
      return name ? `${name} · ${tag}` : `Patient ${tag}`;
    },
    [displayRows],
  );

  const rowsWithDashboardStatus = useMemo(
    () => displayRows.map((r) => ({ ...r, status_for_dashboard: r.status })),
    [displayRows],
  );

  const patientFilterLabel = patientFilter ? patientSelectLabel(patientFilter) : null;

  let filteredList = filterPharmacistProductHubListRows(rowsWithDashboardStatus, {
    bucketStatuses: activeBucket?.statuses ?? null,
  });

  const applyActiveOnly = activeOnly && !(activeBucket && isPharmacistArchiveBucketKey(activeBucket.key));
  if (applyActiveOnly) {
    const activeStatuses = new Set(pharmacistRequestActiveStatuses());
    filteredList = filteredList.filter((r) => activeStatuses.has(r.status));
  }
  if (patientFilter) {
    filteredList = filteredList.filter((r) => r.patient_id === patientFilter);
  }
  if (refQuery.trim().length >= 2) {
    filteredList = filteredList.filter((r) =>
      rowMatchesPublicRefQuery(refQuery, [
        r.request_public_ref,
        r.patient_ref,
        r.patient_full_name,
        formatShortId(r.id),
        formatShortId(r.patient_id),
      ]),
    );
  }
  const filteredSorted = [...filteredList].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    return sortNewestFirst ? tb - ta : ta - tb;
  });

  const listFiltersSummary = pharmacistHubListActiveFiltersSummary({
    activeBucket,
    patientLabel: patientFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    activeOnly,
    includeArchivesLabel: tList("includeArchives"),
  });

  const listHasActiveFilters = pharmacistHubListHasActiveFilters({
    activeBucket,
    patientLabel: patientFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    activeOnly,
  });

  const hasManualListFilters = hubListHasManualFilters({
    entityFilter: patientFilter,
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
    setPatientFilter("");
    setRefQuery("");
    setSortNewestFirst(true);
    setActiveOnly(true);
    setFiltersExpandedUser(null);
    replaceHubUrl({ vue: "liste", statut: null, section: null });
  };

  const setStatutFilter = (key: string) => {
    replaceHubUrl({ vue: "liste", statut: key || null });
  };

  const filterBtn = uiActionBtnFilterToggle();
  const hubAccent = parcoursToWorkflowAccent(parcours);
  const hubTitle = tUnified(unifiedHubTitleKey(parcours, "pharmacien"));
  const totalInParcours = displayRows.length;
  const activeInParcours = parcoursCounts[parcours] ?? 0;
  const listTabLabel = listTabLabelForParcours(parcours);
  const emptyCopy = emptyCopyForParcours(parcours);
  const showParcoursLabel = parcours === "tous";

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
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-3">
      <RequestUnifiedHubChrome
        parcours={parcours}
        parcoursCounts={parcoursCounts}
        onParcoursChange={setParcours}
        title={hubTitle}
        workflowAccent={hubAccent}
        tab={tab}
        onTab={setTab}
        tabLabels={{
          dashboard: tList("dashboardTab"),
          list: listTabLabel,
        }}
      />

      {error ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-950">{error}</p>
      ) : null}

      {tab === "dashboard" ? (
        <>
          {displayRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center">
              <p className="text-sm font-medium text-foreground">{emptyCopy.title}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{emptyCopy.hint}</p>
            </div>
          ) : (
            <RequestKindHubDashboard
              kindId={effectiveKindId}
              role="pharmacien"
              rows={displayRows}
              basePath={hubPath}
              unreadById={unreadById}
              preserveSearchParams={preserveSearchParams}
              usePlatformAccent={parcours === "tous"}
            />
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  className="rounded border-input"
                />
                {tList("activeOnly")}
              </label>
              <HubListScopeCount
                activeCount={activeInParcours}
                totalCount={totalInParcours}
                filteredCount={filteredSorted.length}
                activeOnly={activeOnly}
                hasListFilters={listHasActiveFilters}
              />
            </div>
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
                    Référence demande / client
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
                <label className="flex min-w-0 flex-col gap-1">
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
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Patient</span>
                  <select
                    value={patientFilter}
                    onChange={(e) => setPatientFilter(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                  >
                    <option value="">Tous</option>
                    {patientOptions.map((pid) => (
                      <option key={pid} value={pid}>
                        {patientSelectLabel(pid)}
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
            <ul className="flex flex-col gap-3">
              {filteredSorted.map((r) => (
                <li key={r.id} className="list-none">
                  <PharmacistProductDemandeHubCard
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
  );
}

/** @deprecated Utiliser `PharmacistUnifiedRequestsHub`. */
export function PharmacistRequestKindHub(_props: { kindId: RequestKindId }) {
  return <PharmacistUnifiedRequestsHub />;
}

export function PharmacistDemandesHub() {
  return <PharmacistUnifiedRequestsHub />;
}
