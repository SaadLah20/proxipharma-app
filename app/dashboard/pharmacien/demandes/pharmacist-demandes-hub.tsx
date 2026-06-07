"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { RequestKindHubDashboard } from "@/components/requests/hub/request-kind-hub-dashboard";
import {
  DemandeHubTabBar,
  type HubTab,
  PharmacistDemandeCard,
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
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { PageShell } from "@/components/ui/compact-shell";
import { bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { dashboardBucketsForKind } from "@/lib/request-kinds/hub-and-terminal-copy";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindId } from "@/lib/request-kinds/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";
import { usePersistHubVisitUrl } from "@/lib/use-persist-hub-visit-url";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PharmacistRequestKindHub({ kindId }: { kindId: RequestKindId }) {
  const kindConfig = getRequestKindConfig(kindId);
  const hubPath = kindConfig.routes.pharmacistHubPath;
  const refPlaceholder =
    kindConfig.publicRefPrefix === "O" ? "Ex. O042/26" : kindConfig.publicRefPrefix === "C" ? "Ex. C042/26" : "Ex. D042/26";

  const router = useRouter();
  const searchParams = useSearchParams();
  usePersistHubVisitUrl(hubPath);
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

  const isProductHub = kindId === "product_request";
  const useRichPharmacistHubCard = kindId === "product_request" || kindId === "prescription";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PharmacistRequestRow[]>([]);
  const [unreadById, setUnreadById] = useState<Record<string, boolean>>({});
  const [patientFilter, setPatientFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  /** `null` = ouverture auto si filtres URL ou actifs sur la liste. */
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const dashboardBuckets = useMemo(() => dashboardBucketsForKind(kindId, "pharmacien"), [kindId]);

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
    if (searchParams.get("filtres") !== "0") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filtres");
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  }, [searchParams, hubPath, router]);

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

      if (cancelled) return;

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
    }

    const tid = window.setTimeout(() => void loadHubRows(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [router, hubPath, kindId]);

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

  const patientFilterLabel = patientFilter ? patientSelectLabel(patientFilter) : null;

  let filteredList = rowsWithDashboardStatus;
  if (useRichPharmacistHubCard) {
    filteredList = filterPharmacistProductHubListRows(filteredList, {
      bucketStatuses: activeBucket?.statuses ?? null,
    });
  } else if (activeBucket) {
    const allow = new Set(activeBucket.statuses);
    filteredList = filteredList.filter((r) =>
      allow.has((r as { status_for_dashboard?: string }).status_for_dashboard ?? r.status)
    );
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
      ])
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
  });

  const listHasActiveFilters = pharmacistHubListHasActiveFilters({
    activeBucket,
    patientLabel: patientFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
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
    if (key === "") {
      next.delete("statut");
    } else {
      next.set("statut", key);
    }
    router.replace(`${hubPath}?${next.toString()}`, { scroll: false });
  };

  const filterBtn =
    "rounded-md border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm hover:bg-muted/50";

  const listTabLabel =
    kindId === "prescription"
      ? "Toutes les ordonnances"
      : kindId === "free_consultation"
        ? "Toutes les consultations"
        : "Toutes les demandes";

  const hubSubtitle =
    kindId === "prescription"
      ? "Ordonnances reçues : 8 statuts en tête, reprise rapide et liste filtrable."
      : kindId === "free_consultation"
        ? "Consultations libres : lire le message, échanger puis proposer des produits."
        : "8 statuts en tête, reprise rapide et liste filtrable par statut, patient ou référence.";

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
        <Link href="/dashboard/pharmacien" className={p.backLink}>
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
      <PharmacistAccountPageHeader
        eyebrow="Dossiers & réservations"
        title={kindConfig.copy.pharmacistHubTitle}
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
              <RequestKindHubDashboard
                kindId={kindId}
                role="pharmacien"
                rows={rows}
                basePath={hubPath}
                unreadById={unreadById}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">{listTabLabel}</h2>
            <button
              type="button"
              onClick={() => setFiltersExpandedUser(!filtersPanelExpanded)}
              className={filterBtn}
            >
              {filtersPanelExpanded ? "Masquer les filtres" : "Filtres"}
            </button>
          </div>

          {listHasActiveFilters && !filtersPanelExpanded ? (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] leading-snug text-foreground">
              <p>
                <span className="font-semibold">Filtres actifs :</span> {listFiltersSummary}
              </p>
              <button type="button" onClick={clearListFilters} className={clsx("mt-1.5", filterChrome.clearLink)}>
                Tout effacer
              </button>
            </div>
          ) : null}

          {filtersPanelExpanded ? (
            <section className={filterChrome.shell}>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
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
            </section>
          ) : null}

          {filteredSorted.length === 0 ? (
            <div className="space-y-2 py-6 text-center text-xs text-muted-foreground">
              <p>Aucun résultat.</p>
              {listHasActiveFilters ? (
                <button type="button" onClick={clearListFilters} className={filterChrome.clearLink}>
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filteredSorted.map((r) => (
                <li key={r.id} className="list-none">
                  {useRichPharmacistHubCard ? (
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
