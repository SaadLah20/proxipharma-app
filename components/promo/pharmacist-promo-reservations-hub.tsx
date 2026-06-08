"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { DemandeHubTabBar, type HubTab } from "@/components/requests/demande-hub-ui";
import { PharmacistPromoReservationHubCard } from "@/components/promo/promo-reservation-hub-card";
import { PromoReservationsHubDashboard } from "@/components/promo/promo-reservations-hub-dashboard";
import { PageShell } from "@/components/ui/compact-shell";
import {
  hubListFilterChrome as filterChrome,
  hubListFiltersPanelExpanded,
  hubListHasManualFilters,
} from "@/lib/hub-list-filter-chrome";
import { platformDashboardChrome as chrome } from "@/lib/platform-dashboard-chrome";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import {
  bucketForPromoStatusParam,
  filterPromoHubListRows,
  promoDashboardBucketsForRole,
} from "@/lib/promo/reservation-hub-buckets";
import {
  promoHubListActiveFiltersSummary,
  promoHubListHasActiveFilters,
} from "@/lib/promo/reservation-hub-list-filters";
import { fetchPromoOfferLinesByOfferIds } from "@/lib/promo/load-offer-lines";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import { loadPharmacistPromoPatientDirectory } from "@/lib/promo/load-pharmacist-promo-patient-contacts";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";
import { uiActionBtnFilterToggle } from "@/lib/ui-action-buttons";

const HUB_PATH = "/dashboard/pharmacien/reservations-packs";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PharmacistPromoReservationsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("vue"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<PromoReservationHubRow[]>([]);
  const [patientFilter, setPatientFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const dashboardBuckets = useMemo(() => promoDashboardBucketsForRole("pharmacien"), []);
  const listStatutParam = tab === "list" ? searchParams.get("statut") : null;
  const activeBucket = bucketForPromoStatusParam(listStatutParam, dashboardBuckets);

  const setTab = (nextTab: HubTab) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", tabToSearch(nextTab));
    if (nextTab === "dashboard") {
      next.delete("statut");
      setFiltersExpandedUser(null);
    }
    router.replace(`${HUB_PATH}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (tab !== "dashboard") return;
    if (!searchParams.has("statut")) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("statut");
    router.replace(`${HUB_PATH}?${next.toString()}`, { scroll: false });
  }, [tab, searchParams, router]);

  useEffect(() => {
    if (searchParams.get("filtres") !== "0") return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("filtres");
    router.replace(`${HUB_PATH}?${next.toString()}`, { scroll: false });
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError("");
      const ctx = await loadPharmacistPharmacyId();
      if (!ctx.pharmacyId) {
        if (!cancelled) {
          setError(ctx.error ?? "Erreur");
          setLoading(false);
        }
        return;
      }
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/reservations-packs");
        return;
      }

      const [reservationsRes, patientDirectory] = await Promise.all([
        supabase
          .from("pharmacy_promo_reservations")
          .select(
            "id,offer_id,status,pickup_date,pickup_time,public_ref,updated_at,patient_id,pharmacy_promo_offers(title,discount_percent)",
          )
          .eq("pharmacy_id", ctx.pharmacyId)
          .order("updated_at", { ascending: false }),
        loadPharmacistPromoPatientDirectory(),
      ]);

      if (cancelled) return;

      const { data, error: qErr } = reservationsRes;
      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        const rawRows = (data ?? []) as Record<string, unknown>[];
        const offerIds = [...new Set(rawRows.map((r) => r.offer_id as string).filter(Boolean))];
        const linesMap = await fetchPromoOfferLinesByOfferIds(offerIds);

        setRows(
          rawRows.map((r) => {
            const patientId = r.patient_id as string;
            const offerId = r.offer_id as string | undefined;
            const contact = patientDirectory.get(patientId);
            return {
              id: r.id as string,
              status: r.status as PromoReservationHubRow["status"],
              pickup_date: r.pickup_date as string,
              pickup_time: r.pickup_time as string | null,
              public_ref: r.public_ref as string | null,
              updated_at: r.updated_at as string,
              offer_id: offerId,
              pharmacy_id: ctx.pharmacyId ?? undefined,
              offer: r.pharmacy_promo_offers as PromoReservationHubRow["offer"],
              patient: contact
                ? { full_name: contact.full_name, whatsapp: contact.whatsapp }
                : null,
              patient_id: patientId,
              pack_lines: offerId ? linesMap.get(offerId) ?? [] : [],
            };
          }),
        );
      }
      setLoading(false);
    }

    const tid = window.setTimeout(() => void load(), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(tid);
    };
  }, [router]);

  type RowWithPatientId = PromoReservationHubRow;

  const patientOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows as RowWithPatientId[]) {
      const pid = r.patient_id;
      if (!pid || m.has(pid)) continue;
      const name = r.patient?.full_name?.trim();
      m.set(pid, name ? `${name} · #${formatShortId(pid)}` : `Patient #${formatShortId(pid)}`);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [rows]);

  const patientFilterLabel = patientOptions.find(([id]) => id === patientFilter)?.[1] ?? null;
  const submittedCount = useMemo(() => rows.filter((r) => r.status === "submitted").length, [rows]);

  let filteredList = filterPromoHubListRows(rows, {
    bucketStatuses: activeBucket?.statuses ?? null,
  });
  if (patientFilter) {
    filteredList = (filteredList as RowWithPatientId[]).filter((r) => r.patient_id === patientFilter);
  }
  if (refQuery.trim().length >= 2) {
    filteredList = filteredList.filter((r) =>
      rowMatchesPublicRefQuery(refQuery, [r.public_ref, r.offer?.title, r.patient?.full_name]),
    );
  }
  const filteredSorted = [...filteredList].sort((a, b) => {
    const ta = new Date(a.updated_at).getTime();
    const tb = new Date(b.updated_at).getTime();
    return sortNewestFirst ? tb - ta : ta - tb;
  });

  const listFiltersSummary = promoHubListActiveFiltersSummary({
    activeBucket,
    entityLabel: patientFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    entityFieldLabel: "Patient",
  });

  const listHasActiveFilters = promoHubListHasActiveFilters({
    activeBucket,
    entityLabel: patientFilterLabel,
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
    router.replace(`${HUB_PATH}?${next.toString()}`, { scroll: false });
  };

  const setStatutFilter = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("vue", "liste");
    if (key === "") next.delete("statut");
    else next.set("statut", key);
    router.replace(`${HUB_PATH}?${next.toString()}`, { scroll: false });
  };

  const filterBtn = uiActionBtnFilterToggle();

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <PharmacistAccountPageHeader
        eyebrow="Dossiers & réservations"
        title="Réservations packs promo"
        subtitle="Demandes de réservation sur vos offres promo publiées."
        trailing={
          <Link href="/dashboard/pharmacien/offres-promos" className={chrome.ctaOutline}>
            Offres et promos
          </Link>
        }
      />

      <DemandeHubTabBar
        tab={tab}
        onTab={setTab}
        labels={{
          dashboard: "Tableau de bord",
          list: "Toutes les réservations",
        }}
      />

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {submittedCount > 0 && tab === "dashboard" ? (
        <p className="rounded-xl border border-emerald-200/55 bg-emerald-50/40 px-3 py-2 text-sm font-medium text-emerald-950">
          {submittedCount} réservation{submittedCount > 1 ? "s" : ""} en attente de votre réponse.
        </p>
      ) : null}

      {tab === "dashboard" ? (
        rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune réservation pour le moment.
          </p>
        ) : (
          <PromoReservationsHubDashboard role="pharmacien" rows={rows} basePath={HUB_PATH} />
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">Toutes les réservations</h2>
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
              <div className="grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    Référence / pack / patient
                  </span>
                  <span className="relative block">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60"
                      aria-hidden
                    />
                    <input
                      value={refQuery}
                      onChange={(e) => setRefQuery(e.target.value)}
                      placeholder="Ex. P042/26"
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
                  <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Patient</span>
                  <select
                    value={patientFilter}
                    onChange={(e) => setPatientFilter(e.target.value)}
                    className="rounded-lg border border-input bg-background px-2.5 py-2 text-xs text-foreground shadow-sm"
                  >
                    <option value="">Tous les patients</option>
                    {patientOptions.map(([id, label]) => (
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
                    <option value="desc">Plus récentes d&apos;abord</option>
                    <option value="asc">Plus anciennes d&apos;abord</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          {filteredSorted.length === 0 ? (
            <div className="space-y-2 py-6 text-center text-xs text-muted-foreground">
              <p>{rows.length === 0 ? "Aucune réservation pour le moment." : "Aucun résultat pour ces filtres."}</p>
              {listHasActiveFilters ? (
                <button type="button" onClick={clearListFilters} className={filterChrome.clearLink}>
                  Effacer les filtres
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {filteredSorted.map((r) => (
                <li key={r.id}>
                  <PharmacistPromoReservationHubCard row={r} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageShell>
  );
}
