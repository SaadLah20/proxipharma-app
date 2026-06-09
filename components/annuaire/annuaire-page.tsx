"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { AnnuaireFooter } from "@/components/annuaire/annuaire-footer";
import { AnnuairePagination } from "@/components/annuaire/annuaire-pagination";
import { AnnuairePharmacyCard } from "@/components/annuaire/annuaire-pharmacy-card";
import {
  AnnuaireRadiusPicker,
  type AnnuaireRadiusKm,
  type AnnuaireRadiusMode,
} from "@/components/annuaire/annuaire-radius-picker";
import { haversineKm, isPlausibleMoroccoCoords, requestUserLocation } from "@/lib/annuaire/geo";
import { pharmacyCoordsForDistance } from "@/lib/pharmacy-navigation";
import {
  loadScheduleBundlesByPharmacyIds,
  openSnapshotForBundle,
} from "@/lib/annuaire/schedule-bundle";
import { ANNUAIRE_PAGE_SIZE, type AnnuairePharmacyEnriched, type AnnuairePharmacyRow } from "@/lib/annuaire/types";
import { collatorForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { supabase } from "@/lib/supabase";
import { uiSurfaceCard } from "@/lib/ui-surfaces";

function AnnuaireResultsCount({
  filteredCount,
  totalCount,
  searchQuery,
  radiusEnabled,
  inRadiusCount,
}: {
  filteredCount: number;
  totalCount: number;
  searchQuery: string;
  radiusEnabled: boolean;
  inRadiusCount: number | undefined;
}) {
  const t = useTranslations("annuaire");

  return (
    <p className="text-[11px] text-muted-foreground sm:text-xs">
      {t("results.count", { count: filteredCount })}
      {searchQuery.trim().length >= 2 ? ` ${t("results.countFiltered", { total: totalCount })}` : ""}
      {radiusEnabled && inRadiusCount != null ? (
        <span> {t("results.inRadius", { count: inRadiusCount })}</span>
      ) : null}
    </p>
  );
}

export function AnnuairePage() {
  const t = useTranslations("annuaire");
  const locale = useLocale() as AppLocale;
  const nameCollator = useMemo(() => collatorForLocale(locale), [locale]);

  const [pharmacies, setPharmacies] = useState<AnnuairePharmacyRow[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Awaited<ReturnType<typeof loadScheduleBundlesByPharmacyIds>>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOnCall, setFilterOnCall] = useState(false);
  const [radiusMode, setRadiusMode] = useState<AnnuaireRadiusMode>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const radiusEnabled = radiusMode !== "all";
  const radiusKm: AnnuaireRadiusKm = radiusMode === "all" ? 5 : radiusMode;

  const loadPharmacies = useCallback(async () => {
    setErrorMessage("");
    const { data, error } = await supabase
      .from("pharmacies")
      .select(
        "id,nom,nom_ar,ville,adresse,adresse_ar,telephone,whatsapp,statut,public_ref,cover_image_path,logo_url,latitude,longitude,maps_url,rating_avg,rating_count"
      )
      .order("nom", { ascending: true });

    if (error) {
      setErrorMessage(error.message);
      setPharmacies([]);
    } else {
      setPharmacies((data ?? []) as AnnuairePharmacyRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const tid = window.setTimeout(() => void loadPharmacies(), 0);
    return () => window.clearTimeout(tid);
  }, [loadPharmacies]);

  const pharmacyIdsKey = useMemo(() => pharmacies.map((p) => p.id).join(","), [pharmacies]);

  useEffect(() => {
    if (!pharmacyIdsKey) return;
    let cancelled = false;
    const ids = pharmacyIdsKey.split(",").filter(Boolean);
    void loadScheduleBundlesByPharmacyIds(ids).then((map) => {
      if (!cancelled) setScheduleMap(map);
    });
    return () => {
      cancelled = true;
    };
  }, [pharmacyIdsKey]);

  const schedulesLoading =
    pharmacies.length > 0 && pharmacies.some((p) => !scheduleMap.has(p.id));

  const enriched: AnnuairePharmacyEnriched[] = useMemo(() => {
    return pharmacies.map((p) => {
      const bundle = scheduleMap.get(p.id);
      const open = openSnapshotForBundle(bundle);
      const coords = pharmacyCoordsForDistance(p);
      const lat = coords?.latitude ?? NaN;
      const lng = coords?.longitude ?? NaN;
      const hasValidLocation = coords ? isPlausibleMoroccoCoords(lat, lng) : false;
      let distanceKm: number | null = null;
      if (radiusEnabled && userLocation && hasValidLocation && coords) {
        distanceKm = haversineKm(userLocation.lat, userLocation.lng, coords.latitude, coords.longitude);
      }
      return { ...p, open, distanceKm, hasValidLocation };
    });
  }, [pharmacies, scheduleMap, radiusEnabled, userLocation]);

  const filtered = useMemo(() => {
    let list = enriched;

    if (searchQuery.trim().length >= 2) {
      list = list.filter((p) =>
        rowMatchesPublicRefQuery(searchQuery, [
          p.public_ref,
          p.nom,
          p.nom_ar,
          p.ville,
          p.adresse,
          p.adresse_ar,
          p.telephone,
          p.whatsapp,
        ])
      );
    }

    if (filterOpen) {
      list = list.filter((p) => p.open.status === "open");
    }

    if (filterOnCall) {
      list = list.filter((p) => p.open.onCallBadgeVisible);
    }

    if (radiusEnabled && userLocation) {
      const inRadius = list
        .filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      const noGps = list.filter((p) => !p.hasValidLocation);
      list = [...inRadius, ...noGps];
    } else {
      list = [...list].sort((a, b) => nameCollator.compare(a.nom, b.nom));
    }

    return list;
  }, [enriched, searchQuery, filterOpen, filterOnCall, radiusEnabled, userLocation, radiusKm, nameCollator]);

  const inRadiusCount = useMemo(() => {
    if (!radiusEnabled || !userLocation) return undefined;
    return filtered.filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm).length;
  }, [filtered, radiusEnabled, userLocation, radiusKm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ANNUAIRE_PAGE_SIZE));

  const listFilterKey = useMemo(
    () =>
      [
        searchQuery,
        filterOpen,
        filterOnCall,
        radiusMode,
        userLocation?.lat ?? "",
        userLocation?.lng ?? "",
      ].join("|"),
    [searchQuery, filterOpen, filterOnCall, radiusMode, userLocation]
  );

  const [pageState, setPageState] = useState({ filterKey: listFilterKey, page: 1 });

  const effectivePage = useMemo(() => {
    const raw = pageState.filterKey === listFilterKey ? pageState.page : 1;
    return Math.min(Math.max(1, raw), totalPages);
  }, [pageState, listFilterKey, totalPages]);

  const setEffectivePage = useCallback(
    (next: number) => {
      setPageState({ filterKey: listFilterKey, page: next });
    },
    [listFilterKey]
  );

  const pageItems = useMemo(() => {
    const start = (effectivePage - 1) * ANNUAIRE_PAGE_SIZE;
    return filtered.slice(start, start + ANNUAIRE_PAGE_SIZE);
  }, [filtered, effectivePage]);

  const activateRadiusSearch = async (): Promise<boolean> => {
    setLocationError("");
    if (userLocation) return true;

    setLocationLoading(true);
    const result = await requestUserLocation();
    if (!result.ok) {
      const msg =
        result.code === "denied"
          ? t("geo.denied")
          : result.code === "timeout"
            ? t("geo.timeout")
            : result.code === "unsupported"
              ? t("geo.unsupported")
              : t("geo.unavailable");
      setLocationError(msg);
      setLocationLoading(false);
      setUserLocation(null);
      return false;
    }
    setUserLocation({ lat: result.lat, lng: result.lng });
    setLocationLoading(false);
    return true;
  };

  const handleRadiusSelect = async (next: AnnuaireRadiusMode) => {
    if (next === "all") {
      setRadiusMode("all");
      setUserLocation(null);
      setLocationError("");
      return;
    }
    setRadiusMode(next);
    const ok = await activateRadiusSearch();
    if (!ok) {
      setRadiusMode("all");
    }
  };

  const resultsCountProps = {
    filteredCount: filtered.length,
    totalCount: pharmacies.length,
    searchQuery,
    radiusEnabled,
    inRadiusCount,
  };

  const searchToolbar = (
    <div className="space-y-2">
      <label className="block">
        <span className="sr-only">{t("search.label")}</span>
        <span className="relative block">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </span>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-x-2.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-foreground sm:text-xs">
            <input
              type="checkbox"
              checked={filterOpen}
              onChange={(e) => setFilterOpen(e.target.checked)}
              className="size-3.5 shrink-0 rounded border-border accent-primary"
            />
            <span className="font-semibold whitespace-nowrap">{t("filter.open")}</span>
          </label>
          <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-foreground sm:text-xs">
            <input
              type="checkbox"
              checked={filterOnCall}
              onChange={(e) => setFilterOnCall(e.target.checked)}
              className="size-3.5 shrink-0 rounded border-border accent-primary"
            />
            <span className="font-semibold whitespace-nowrap">{t("filter.onCall")}</span>
          </label>
          {schedulesLoading ? (
            <span className="shrink-0 whitespace-nowrap text-[10px] text-muted-foreground">
              {t("filter.schedulesLoading")}
            </span>
          ) : null}
        </div>

        <AnnuaireRadiusPicker
          mode={radiusMode}
          loading={locationLoading}
          inRadiusCount={inRadiusCount}
          onSelect={(next) => void handleRadiusSelect(next)}
        />
      </div>

      <AnnuaireResultsCount {...resultsCountProps} />

      {locationError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-[10px] font-medium text-destructive">
          {locationError}
        </p>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <main className="flex min-h-[50vh] flex-col items-center justify-center gap-3 bg-muted/20 p-6">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">{t("loading")}</p>
      </main>
    );
  }

  return (
    <div className="flex flex-col bg-muted/20">
      <section className="relative border-b border-border/80 bg-gradient-to-b from-primary/[0.08] via-card to-muted/30">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(13,148,136,0.1),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-3.5 sm:px-5 sm:py-4">
          <h1 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{t("hero.title")}</h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("hero.subtitle")}
          </p>
        </div>
      </section>

      <div className="sticky top-[3.25rem] z-30 sm:top-14">
        <div className="border-b border-border bg-card/95 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
          <div className="mx-auto max-w-5xl px-4 py-3 sm:px-5 sm:py-3.5">{searchToolbar}</div>
        </div>
      </div>

      <main className="relative z-0 mx-auto w-full max-w-5xl px-4 pb-5 pt-4 sm:px-5">
        {errorMessage ? (
          <p className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {pageItems.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {pageItems.map((pharmacy) => (
                <AnnuairePharmacyCard key={pharmacy.id} pharmacy={pharmacy} />
              ))}
            </div>
            <div className="mt-6">
              <AnnuairePagination
                page={effectivePage}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={ANNUAIRE_PAGE_SIZE}
                onPage={setEffectivePage}
              />
            </div>
          </>
        ) : (
          <p className={cn(uiSurfaceCard, "py-16 text-center text-sm text-muted-foreground")}>{t("empty")}</p>
        )}
      </main>

      <AnnuaireFooter />
    </div>
  );
}
