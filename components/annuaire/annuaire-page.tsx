"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
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
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { supabase } from "@/lib/supabase";

export function AnnuairePage() {
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
        "id,nom,ville,adresse,telephone,whatsapp,statut,public_ref,cover_image_path,logo_url,latitude,longitude,maps_url,rating_avg,rating_count"
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
        rowMatchesPublicRefQuery(searchQuery, [p.public_ref, p.nom, p.ville, p.adresse, p.telephone, p.whatsapp])
      );
    }

    if (filterOpen) {
      list = list.filter((p) => p.open.status === "open");
    }

    if (filterOnCall) {
      list = list.filter((p) => p.open.onCallNow || p.open.onCallToday);
    }

    if (radiusEnabled && userLocation) {
      const inRadius = list
        .filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
      const noGps = list.filter((p) => !p.hasValidLocation);
      list = [...inRadius, ...noGps];
    } else {
      list = [...list].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    }

    return list;
  }, [enriched, searchQuery, filterOpen, filterOnCall, radiusEnabled, userLocation, radiusKm]);

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
          ? "Localisation refusée. Activez-la dans les paramètres du navigateur ou choisissez « Toutes »."
          : result.code === "timeout"
            ? "Délai dépassé. Réessayez ou choisissez « Toutes »."
            : result.code === "unsupported"
              ? "Votre navigateur ne prend pas en charge la géolocalisation."
              : "Position indisponible. Réessayez plus tard.";
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

  if (loading) {
    return (
      <main className="flex min-h-[50vh] flex-1 flex-col items-center justify-center gap-3 bg-background p-6">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium text-foreground">Chargement de l&apos;annuaire…</p>
      </main>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <section className="relative z-20 border-b border-primary/15 text-white shadow-md">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-left bg-no-repeat sm:bg-[center_left_20%]"
          style={{ backgroundImage: "url(/brand/annuaire-hero.png)" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-emerald-950/92 via-emerald-900/78 to-emerald-900/25 sm:from-emerald-950/88 sm:via-emerald-900/55"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-4 py-4 sm:px-5 sm:py-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">ProxiPharma</p>
          <h1 className="mt-0.5 text-lg font-bold tracking-tight sm:text-xl">Annuaire interactif des pharmacies</h1>
          <p className="mt-1.5 max-w-2xl text-xs leading-snug text-emerald-50/95 sm:text-sm sm:leading-relaxed">
            Consultez les officines, appelez ou écrivez en un clic, et lancez vos demandes depuis la fiche — sans
            intermédiaire.
          </p>

          <div className="relative z-10 mt-3 space-y-2 overflow-visible rounded-xl border border-white/20 bg-white/10 p-2.5 shadow-inner ring-1 ring-white/15 backdrop-blur-sm sm:p-3">
            <label className="block">
              <span className="sr-only">Rechercher une pharmacie</span>
              <span className="relative block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-emerald-900/50"
                  aria-hidden
                />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Nom, ville, adresse ou code officine…"
                  className="w-full rounded-lg border border-white/40 bg-white py-2 pl-9 pr-2.5 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-white/60"
                />
              </span>
            </label>

            <div className="flex items-center gap-2 overflow-visible">
              <div className="flex min-w-0 flex-1 items-center gap-x-2.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-emerald-50 sm:text-xs">
                  <input
                    type="checkbox"
                    checked={filterOpen}
                    onChange={(e) => setFilterOpen(e.target.checked)}
                    className="size-3.5 shrink-0 rounded border-white/50 bg-white/90 accent-emerald-700"
                  />
                  <span className="font-semibold whitespace-nowrap">Ouvertes</span>
                </label>
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-emerald-50 sm:text-xs">
                  <input
                    type="checkbox"
                    checked={filterOnCall}
                    onChange={(e) => setFilterOnCall(e.target.checked)}
                    className="size-3.5 shrink-0 rounded border-white/50 bg-white/90 accent-emerald-700"
                  />
                  <span className="font-semibold whitespace-nowrap">En garde</span>
                </label>
                {schedulesLoading ? (
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-emerald-100/80">Horaires…</span>
                ) : null}
              </div>

              <AnnuaireRadiusPicker
                mode={radiusMode}
                loading={locationLoading}
                inRadiusCount={inRadiusCount}
                onSelect={(next) => void handleRadiusSelect(next)}
              />
            </div>

            {locationError ? (
              <p className="rounded-lg bg-amber-400/20 px-2 py-1 text-[10px] font-medium text-amber-50 ring-1 ring-amber-200/30">
                {locationError}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <p className="mx-auto max-w-5xl px-4 pt-2 text-[11px] text-muted-foreground sm:px-5">
        <span className="font-semibold text-foreground">{filtered.length}</span> officine
        {filtered.length !== 1 ? "s" : ""}
        {searchQuery.trim().length >= 2 ? ` (sur ${pharmacies.length})` : ""}
        {radiusEnabled && inRadiusCount != null ? (
          <span> · {inRadiusCount} dans le rayon</span>
        ) : null}
      </p>

      <main className="relative z-0 mx-auto w-full max-w-5xl flex-1 px-4 pb-5 pt-3 sm:px-5">
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
          <p className="rounded-xl border border-dashed border-border bg-muted/15 py-16 text-center text-sm text-muted-foreground">
            Aucune pharmacie ne correspond à vos critères.
          </p>
        )}
      </main>

      <AnnuaireFooter />
    </div>
  );
}
