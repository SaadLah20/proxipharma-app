"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { DemandeHubTabBar, type HubTab } from "@/components/requests/demande-hub-ui";
import { PatientPromoReservationHubCard } from "@/components/promo/promo-reservation-hub-card";
import { PromoReservationsHubDashboard } from "@/components/promo/promo-reservations-hub-dashboard";
import { PageShell } from "@/components/ui/compact-shell";
import {
  hubListFilterChrome as filterChrome,
  hubListFiltersPanelExpanded,
  hubListHasManualFilters,
} from "@/lib/hub-list-filter-chrome";
import type { AppLocale } from "@/lib/i18n/config";
import { patientPromoDashboardBuckets } from "@/lib/i18n/promo-hub-buckets";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import {
  bucketForPromoStatusParam,
  filterPromoHubListRows,
} from "@/lib/promo/reservation-hub-buckets";
import {
  promoHubListActiveFiltersSummary,
  promoHubListHasActiveFilters,
} from "@/lib/promo/reservation-hub-list-filters";
import { fetchPromoOfferLinesByOfferIds } from "@/lib/promo/load-offer-lines";
import type { PromoReservationHubRow } from "@/lib/promo/reservation-hub-sections";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { supabase } from "@/lib/supabase";
import { uiActionBtnFilterToggle } from "@/lib/ui-action-buttons";

const HUB_PATH = "/dashboard/patient/packs-promo";

function tabFromSearch(v: string | null): HubTab {
  return v === "liste" ? "list" : "dashboard";
}

function tabToSearch(t: HubTab): string {
  return t === "list" ? "liste" : "dashboard";
}

export function PatientPromoReservationsHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = tabFromSearch(searchParams.get("vue"));
  const locale = useLocale() as AppLocale;
  const t = useTranslations("promo");
  const ta = useTranslations("account");
  const tList = useTranslations("hub.listChrome");
  const tDemandes = useTranslations("demandes");
  const tc = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PromoReservationHubRow[]>([]);
  const [error, setError] = useState("");
  const [pharmacyFilter, setPharmacyFilter] = useState("");
  const [refQuery, setRefQuery] = useState("");
  const [sortNewestFirst, setSortNewestFirst] = useState(true);
  const [filtersExpandedUser, setFiltersExpandedUser] = useState<boolean | null>(null);

  const dashboardBuckets = useMemo(() => patientPromoDashboardBuckets(t), [t]);
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
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/patient/packs-promo");
        return;
      }

      const { data, error: qErr } = await supabase
        .from("pharmacy_promo_reservations")
        .select(
          "id,offer_id,status,pickup_date,pickup_time,public_ref,updated_at,pharmacy_id,pharmacy_promo_offers(title,discount_percent),pharmacies:pharmacy_id(nom,nom_ar,ville)",
        )
        .order("updated_at", { ascending: false });

      if (cancelled) return;

      if (qErr) {
        setError(qErr.message);
        setRows([]);
      } else {
        const rawRows = (data ?? []) as Record<string, unknown>[];
        const offerIds = [...new Set(rawRows.map((r) => r.offer_id as string).filter(Boolean))];
        const linesMap = await fetchPromoOfferLinesByOfferIds(offerIds);

        setRows(
          rawRows.map((r) => {
            const offerId = r.offer_id as string | undefined;
            return {
              id: r.id as string,
              status: r.status as PromoReservationHubRow["status"],
              pickup_date: r.pickup_date as string,
              pickup_time: r.pickup_time as string | null,
              public_ref: r.public_ref as string | null,
              updated_at: r.updated_at as string,
              offer_id: offerId,
              pharmacy_id: r.pharmacy_id as string | undefined,
              offer: r.pharmacy_promo_offers as PromoReservationHubRow["offer"],
              pharmacy: r.pharmacies as PromoReservationHubRow["pharmacy"],
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

  const pharmacyOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      if (!r.pharmacy_id || m.has(r.pharmacy_id)) continue;
      const ph = r.pharmacy;
      m.set(
        r.pharmacy_id,
        ph?.nom
          ? `${pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar })}${ph.ville ? ` (${ph.ville})` : ""}`
          : `${tDemandes("pharmacyFallback")} ${r.pharmacy_id.slice(0, 8)}…`,
      );
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], locale));
  }, [rows, locale, tDemandes]);

  const pharmacyFilterLabel = pharmacyOptions.find(([id]) => id === pharmacyFilter)?.[1] ?? null;

  let filteredList = filterPromoHubListRows(rows, {
    bucketStatuses: activeBucket?.statuses ?? null,
  });
  if (pharmacyFilter) filteredList = filteredList.filter((r) => r.pharmacy_id === pharmacyFilter);
  if (refQuery.trim().length >= 2) {
    filteredList = filteredList.filter((r) =>
      rowMatchesPublicRefQuery(refQuery, [
        r.public_ref,
        r.offer?.title,
        r.pharmacy?.nom,
        r.pharmacy?.nom_ar,
        r.pharmacy?.ville,
      ]),
    );
  }
  const filteredSorted = [...filteredList].sort((a, b) => {
    const ta = new Date(a.updated_at).getTime();
    const tb = new Date(b.updated_at).getTime();
    return sortNewestFirst ? tb - ta : ta - tb;
  });

  const listFiltersSummary = promoHubListActiveFiltersSummary({
    activeBucket,
    entityLabel: pharmacyFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
    entityFieldLabel: tList("pharmacy"),
  });

  const listHasActiveFilters = promoHubListHasActiveFilters({
    activeBucket,
    entityLabel: pharmacyFilterLabel,
    referenceQuery: refQuery,
    sortNewestFirst,
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
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <PatientAccountPageHeader
        eyebrow={ta("myDossiers")}
        title={t("hubTitle")}
        subtitle={t("hubSubtitle")}
        backHref="/dashboard/patient/pharmacies"
        backLabel={ta("backToPharmacies")}
        trailing={
          <Link href="/dashboard/notifications" className={p.headerAction}>
            {tc("notifications")}
          </Link>
        }
      />

      <DemandeHubTabBar
        tab={tab}
        onTab={setTab}
        labels={{
          dashboard: tList("dashboardTab"),
          list: t("dashboard.allReservations"),
        }}
      />

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {tab === "dashboard" ? (
        rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
            <p>{t("empty")}</p>
            <Link href="/dashboard/patient/pharmacies" className={p.linkInline}>
              {t("findPharmacy")}
            </Link>
          </div>
        ) : (
          <PromoReservationsHubDashboard role="patient" rows={rows} basePath={HUB_PATH} />
        )
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">{t("dashboard.allReservations")}</h2>
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
              <p>{rows.length === 0 ? t("empty") : tList("noResults")}</p>
              {rows.length === 0 ? (
                <Link href="/dashboard/patient/pharmacies" className={filterChrome.clearLink}>
                  {t("findPharmacy")}
                </Link>
              ) : listHasActiveFilters ? (
                <button type="button" onClick={clearListFilters} className={filterChrome.clearLink}>
                  {tList("clearFilters")}
                </button>
              ) : null}
            </div>
          ) : (
            <ul className="space-y-2.5">
              {filteredSorted.map((r) => (
                <li key={r.id}>
                  <PatientPromoReservationHubCard row={r} locale={locale} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </PageShell>
  );
}
