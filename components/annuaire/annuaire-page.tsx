"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPinned, Search } from "lucide-react";
import { clsx } from "clsx";
import { AnnuaireFooter } from "@/components/annuaire/annuaire-footer";
import { AnnuairePagination } from "@/components/annuaire/annuaire-pagination";
import { AnnuairePharmacyCard } from "@/components/annuaire/annuaire-pharmacy-card";
import {
  formatDistanceKm,
  haversineKm,
  isPlausibleMoroccoCoords,
  requestUserLocation,
} from "@/lib/annuaire/geo";
import {
  loadScheduleBundlesByPharmacyIds,
  openSnapshotForBundle,
} from "@/lib/annuaire/schedule-bundle";
import { ANNUAIRE_PAGE_SIZE, type AnnuairePharmacyEnriched, type AnnuairePharmacyRow } from "@/lib/annuaire/types";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { supabase } from "@/lib/supabase";

const RADIUS_OPTIONS_KM = [2, 5, 10, 25] as const;

export function AnnuairePage() {
  const [pharmacies, setPharmacies] = useState<AnnuairePharmacyRow[]>([]);
  const [scheduleMap, setScheduleMap] = useState<Awaited<ReturnType<typeof loadScheduleBundlesByPharmacyIds>>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterOnCall, setFilterOnCall] = useState(false);
  const [page, setPage] = useState(1);

  const [radiusEnabled, setRadiusEnabled] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");

  const loadPharmacies = useCallback(async () => {
    setErrorMessage("");
    const { data, error } = await supabase
      .from("pharmacies")
      .select(
        "id,nom,ville,adresse,telephone,whatsapp,statut,public_ref,cover_image_path,logo_url,latitude,longitude,maps_url"
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

  useEffect(() => {
    if (pharmacies.length === 0) return;
    let cancelled = false;
    setSchedulesLoading(true);
    const ids = pharmacies.map((p) => p.id);
    void loadScheduleBundlesByPharmacyIds(ids).then((map) => {
      if (!cancelled) {
        setScheduleMap(map);
        setSchedulesLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pharmacies]);

  const enriched: AnnuairePharmacyEnriched[] = useMemo(() => {
    return pharmacies.map((p) => {
      const bundle = scheduleMap.get(p.id);
      const open = openSnapshotForBundle(bundle);
      const lat = p.latitude != null ? Number(p.latitude) : NaN;
      const lng = p.longitude != null ? Number(p.longitude) : NaN;
      const hasValidLocation = isPlausibleMoroccoCoords(lat, lng);
      let distanceKm: number | null = null;
      if (radiusEnabled && userLocation && hasValidLocation) {
        distanceKm = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / ANNUAIRE_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [searchQuery, filterOpen, filterOnCall, radiusEnabled, radiusKm, userLocation]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * ANNUAIRE_PAGE_SIZE;
    return filtered.slice(start, start + ANNUAIRE_PAGE_SIZE);
  }, [filtered, page]);

  const activateRadiusSearch = async () => {
    setLocationError("");
    setLocationLoading(true);
    const result = await requestUserLocation();
    if (!result.ok) {
      const msg =
        result.code === "denied"
          ? "Localisation refusée. Activez-la dans les paramètres du navigateur ou utilisez la recherche par ville."
          : result.code === "timeout"
            ? "Délai dépassé. Réessayez ou désactivez le mode à proximité."
            : result.code === "unsupported"
              ? "Votre navigateur ne prend pas en charge la géolocalisation."
              : "Position indisponible. Réessayez plus tard.";
      setLocationError(msg);
      setLocationLoading(false);
      setRadiusEnabled(false);
      setUserLocation(null);
      return;
    }
    setUserLocation({ lat: result.lat, lng: result.lng });
    setRadiusEnabled(true);
    setLocationLoading(false);
  };

  const disableRadius = () => {
    setRadiusEnabled(false);
    setUserLocation(null);
    setLocationError("");
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
      {/* Bandeau header charte (distinct du listing) */}
      <section className="border-b border-primary/15 bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white shadow-md">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">ProxiPharma</p>
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">Annuaire interactif des pharmacies</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-emerald-50/95">
            Consultez les officines, appelez ou écrivez en un clic, et lancez vos demandes depuis la fiche — sans
            intermédiaire.
          </p>
        </div>
      </section>

      <section className="border-b border-border/80 bg-muted/25">
        <div className="mx-auto max-w-5xl space-y-3 px-4 py-4 sm:px-5 sm:py-5">
          <label className="block">
            <span className="sr-only">Rechercher une pharmacie</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nom, ville, adresse ou code officine…"
                className="w-full rounded-xl border border-input bg-card py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none placeholder:text-muted-foreground/80 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filterOpen}
                onChange={(e) => setFilterOpen(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="font-medium">Ouvertes</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filterOnCall}
                onChange={(e) => setFilterOnCall(e.target.checked)}
                className="size-4 rounded border-input"
              />
              <span className="font-medium">En garde</span>
            </label>
            {schedulesLoading ? (
              <span className="text-[11px] text-muted-foreground">Mise à jour des horaires…</span>
            ) : null}
          </div>

          <div className="rounded-xl border border-border/80 bg-card p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <MapPinned className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-foreground">Pharmacies à proximité</p>
                  <p className="text-[11px] text-muted-foreground">
                    Utilise votre position (jamais stockée). Les officines sans GPS restent listées sans distance.
                  </p>
                </div>
              </div>
              {radiusEnabled ? (
                <button
                  type="button"
                  onClick={disableRadius}
                  className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted/50"
                >
                  Désactiver
                </button>
              ) : (
                <button
                  type="button"
                  disabled={locationLoading}
                  onClick={() => void activateRadiusSearch()}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60"
                >
                  {locationLoading ? "Localisation…" : "Autour de moi"}
                </button>
              )}
            </div>

            {radiusEnabled && userLocation ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Rayon :</span>
                {RADIUS_OPTIONS_KM.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => setRadiusKm(km)}
                    className={clsx(
                      "rounded-md px-2 py-1 text-xs font-semibold transition",
                      radiusKm === km
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-muted/30 hover:bg-muted/60"
                    )}
                  >
                    {km} km
                  </button>
                ))}
                <span className="text-[11px] text-muted-foreground">
                  · {filtered.filter((p) => p.distanceKm != null && p.distanceKm <= radiusKm).length} dans le rayon
                </span>
              </div>
            ) : null}

            {locationError ? (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">{locationError}</p>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{filtered.length}</span> officine
            {filtered.length !== 1 ? "s" : ""}
            {searchQuery.trim().length >= 2 ? ` (sur ${pharmacies.length})` : ""}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-5 sm:px-5">
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
                page={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={ANNUAIRE_PAGE_SIZE}
                onPage={setPage}
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
