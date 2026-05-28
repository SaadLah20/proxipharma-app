"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Gift, MapPin, MessageSquare, Package, Phone, Search, Star, Store } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import { one } from "@/lib/embed";
import { PATIENT_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import {
  formatActivityFr,
  pharmacyDisplayName,
  pharmacyKindLabelsFr,
  pharmacyRatingLabelFr,
  pharmacyWhatsAppHref,
  type PatientPharmacyDirectoryRow,
} from "@/lib/patient-pharmacy-crm";
import { productRequestPublicTheme as t } from "@/lib/request-kinds/product-request-public-theme";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { supabase } from "@/lib/supabase";

type SortKey = "activity" | "name" | "active";

const ACTIVE_REQUEST_STATUSES = new Set([
  "submitted",
  "in_review",
  "responded",
  "confirmed",
  "treated",
]);

function lastRequestStatusLabelFr(status: string | null): string | null {
  if (!status) return null;
  const bucket = PATIENT_DASHBOARD_BUCKETS.find((b) => b.statuses.includes(status));
  return bucket?.label ?? status;
}

async function loadDirectoryLegacy(patientId: string): Promise<PatientPharmacyDirectoryRow[]> {
  const byId = new Map<string, PatientPharmacyDirectoryRow>();

  const touch = (
    pharmacyId: string,
    ph: {
      id: string;
      nom: string;
      ville: string;
      adresse: string;
      telephone?: string | null;
      whatsapp?: string | null;
      public_ref?: string | null;
      rating_avg?: number | null;
      rating_count?: number | null;
    },
    patch: Partial<
      Pick<
        PatientPharmacyDirectoryRow,
        | "request_count"
        | "active_request_count"
        | "promo_reservation_count"
        | "last_activity_at"
        | "last_request_status"
        | "request_kinds"
      >
    >
  ) => {
    const cur =
      byId.get(pharmacyId) ??
      ({
        pharmacy_id: pharmacyId,
        nom: ph.nom,
        ville: ph.ville,
        adresse: ph.adresse,
        telephone: ph.telephone ?? null,
        whatsapp: ph.whatsapp ?? null,
        pharmacy_public_ref: ph.public_ref ?? null,
        rating_avg: ph.rating_avg ?? null,
        rating_count: ph.rating_count ?? null,
        request_count: 0,
        active_request_count: 0,
        promo_reservation_count: 0,
        last_activity_at: null,
        last_request_status: null,
        request_kinds: [],
      } satisfies PatientPharmacyDirectoryRow);
    if (patch.request_count) cur.request_count += patch.request_count;
    if (patch.active_request_count) cur.active_request_count += patch.active_request_count;
    if (patch.promo_reservation_count) cur.promo_reservation_count += patch.promo_reservation_count;
    if (patch.last_activity_at) {
      const next = new Date(patch.last_activity_at).getTime();
      const prev = cur.last_activity_at ? new Date(cur.last_activity_at).getTime() : 0;
      if (next >= prev) {
        cur.last_activity_at = patch.last_activity_at;
        if (patch.last_request_status !== undefined) {
          cur.last_request_status = patch.last_request_status;
        }
      }
    }
    if (patch.request_kinds?.length) {
      cur.request_kinds = [...new Set([...cur.request_kinds, ...patch.request_kinds])];
    }
    byId.set(pharmacyId, cur);
  };

  const { data: reqData } = await supabase
    .from("requests")
    .select(
      "pharmacy_id, status, request_type, updated_at, created_at, pharmacies(id,nom,ville,adresse,telephone,whatsapp,public_ref,rating_avg,rating_count)"
    )
    .eq("patient_id", patientId)
    .neq("status", "draft");

  for (const row of reqData ?? []) {
    const raw = row as {
      pharmacy_id: string;
      status: string;
      request_type: string;
      updated_at: string;
      created_at: string;
      pharmacies: unknown;
    };
    const ph = one(raw.pharmacies) as Parameters<typeof touch>[1] | null;
    if (!ph?.id) continue;
    const at = raw.updated_at ?? raw.created_at;
    touch(ph.id, ph, {
      request_count: 1,
      active_request_count: ACTIVE_REQUEST_STATUSES.has(raw.status) ? 1 : 0,
      last_activity_at: at,
      last_request_status: raw.status,
      request_kinds: [raw.request_type],
    });
  }

  const { data: promoData } = await supabase
    .from("pharmacy_promo_reservations")
    .select(
      "pharmacy_id, updated_at, pharmacies(id,nom,ville,adresse,telephone,whatsapp,public_ref,rating_avg,rating_count)"
    )
    .eq("patient_id", patientId);

  for (const row of promoData ?? []) {
    const raw = row as { pharmacy_id: string; updated_at: string; pharmacies: unknown };
    const ph = one(raw.pharmacies) as Parameters<typeof touch>[1] | null;
    if (!ph?.id) continue;
    touch(ph.id, ph, {
      promo_reservation_count: 1,
      last_activity_at: raw.updated_at,
    });
  }

  return [...byId.values()].sort((a, b) => {
    const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
    const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
    return tb - ta;
  });
}

export function PatientPharmaciesDirectory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationNote, setMigrationNote] = useState("");
  const [rows, setRows] = useState<PatientPharmacyDirectoryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("activity");
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setMigrationNote("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/patient/pharmacies");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "patient") {
      setError("Cet écran est réservé aux patients.");
      setLoading(false);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("patient_pharmacy_directory_enriched");

    if (rpcErr) {
      if (rpcErr.message.includes("patient_pharmacy_directory_enriched")) {
        setMigrationNote(
          "Liste enrichie indisponible : appliquez `20260626_001_patient_pharmacy_directory_crm.sql`. Affichage simplifié."
        );
        try {
          setRows(await loadDirectoryLegacy(user.id));
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erreur de chargement.");
        }
      } else {
        setError(rpcErr.message);
      }
    } else {
      setRows((data ?? []) as PatientPharmacyDirectoryRow[]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (onlyActive) {
      list = list.filter((r) => r.active_request_count > 0 || r.promo_reservation_count > 0);
    }
    if (searchQuery.trim().length >= 2) {
      list = list.filter((r) =>
        rowMatchesPublicRefQuery(searchQuery, [
          r.pharmacy_public_ref,
          r.nom,
          r.ville,
          r.adresse,
          r.telephone,
          r.whatsapp,
        ])
      );
    }
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => (a.nom ?? "").localeCompare(b.nom ?? "", "fr"));
    } else if (sort === "active") {
      sorted.sort((a, b) => b.active_request_count - a.active_request_count);
    } else {
      sorted.sort((a, b) => {
        const ta = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
        const tb = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
        return tb - ta;
      });
    }
    return sorted;
  }, [rows, searchQuery, sort, onlyActive]);

  const stats = useMemo(() => {
    const withActive = rows.filter((r) => r.active_request_count > 0).length;
    const withPromo = rows.filter((r) => r.promo_reservation_count > 0).length;
    return { total: rows.length, withActive, withPromo };
  }, [rows]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-5xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-5xl" className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-sky-300/50 bg-gradient-to-br from-sky-600 via-sky-600/95 to-teal-600 p-4 text-white shadow-md ring-1 ring-sky-300/40">
        <Link href="/dashboard/demandes" className={`text-xs font-medium underline ${t.headerEyebrow}`}>
          ← Mes demandes
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-bold tracking-tight">
          <Store className="h-5 w-5 shrink-0 opacity-90" />
          Mes pharmacies
        </h1>
        <p className={`mt-1 text-xs ${t.headerSubtitle}`}>
          Officines avec lesquelles vous avez déjà échangé (demandes, ordonnances, consultations ou packs promo).
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sky-200/70 bg-card p-3 shadow-sm ring-1 ring-sky-100/60">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-sky-950">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-amber-200/70 bg-card p-3 shadow-sm ring-1 ring-amber-100/50">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dossiers en cours</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{stats.withActive}</p>
        </div>
        <div className="rounded-xl border border-violet-200/70 bg-card p-3 shadow-sm ring-1 ring-violet-100/50">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Avec pack promo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-950">{stats.withPromo}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recherche
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-600/70" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, ville, code officine…"
              className={`w-full rounded-lg border bg-background py-2 pl-8 pr-2 text-xs font-normal normal-case tracking-normal text-foreground ${t.searchInput}`}
            />
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Trier
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case"
            >
              <option value="activity">Dernière activité</option>
              <option value="active">Dossiers actifs</option>
              <option value="name">Nom A → Z</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
              className="rounded border-input"
            />
            Actives seulement
          </label>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {migrationNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{migrationNote}</p>
      ) : null}

      {rows.length === 0 && !error ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-sky-400/60" />
          Aucune pharmacie pour l’instant. Parcourez l’annuaire pour contacter une officine.
          <Link href="/" className="mt-3 block font-semibold text-sky-800 underline">
            Annuaire des pharmacies
          </Link>
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucune pharmacie ne correspond à ces critères.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredRows.map((r) => {
            const wa = pharmacyWhatsAppHref(r.whatsapp);
            const rating = pharmacyRatingLabelFr(r.rating_avg, r.rating_count);
            const lastStatus = lastRequestStatusLabelFr(r.last_request_status);
            return (
              <li key={r.pharmacy_id}>
                <Link
                  href={`/dashboard/patient/pharmacies/${r.pharmacy_id}`}
                  className="group flex flex-col rounded-xl border border-border bg-card p-3 shadow-sm transition hover:border-sky-300/60 hover:shadow-md hover:ring-1 hover:ring-sky-200/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {r.pharmacy_public_ref?.trim() ? (
                        <p className="font-mono text-[11px] font-bold text-sky-900">{r.pharmacy_public_ref.trim()}</p>
                      ) : null}
                      <p className="truncate font-semibold text-foreground">{pharmacyDisplayName(r.nom)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {r.ville?.trim() ? `${r.ville.trim()} · ` : ""}
                        {r.adresse?.trim() || "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{pharmacyKindLabelsFr(r.request_kinds)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-sky-800" />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.active_request_count > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                        <Package className="h-3 w-3" />
                        {r.active_request_count} en cours
                      </span>
                    ) : null}
                    {r.request_count > 0 ? (
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {r.request_count} dossier{r.request_count > 1 ? "s" : ""}
                      </span>
                    ) : null}
                    {r.promo_reservation_count > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-950">
                        <Gift className="h-3 w-3" />
                        {r.promo_reservation_count} promo
                      </span>
                    ) : null}
                    {rating ? (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-900">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                        {rating}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Dernière activité : {formatActivityFr(r.last_activity_at)}
                    {lastStatus ? ` · ${lastStatus}` : ""}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2 border-t border-border/60 pt-2" onClick={(e) => e.preventDefault()}>
                    {wa ? (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-800 underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MessageSquare className="h-3 w-3" />
                        WhatsApp
                      </a>
                    ) : null}
                    {r.telephone ? (
                      <a
                        href={`tel:${r.telephone}`}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone className="h-3 w-3" />
                        {r.telephone}
                      </a>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
