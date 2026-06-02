"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, Gift, MapPin, MessageSquare, Package, Phone, Search, Star, Store } from "lucide-react";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
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
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
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

/** Libellé court singulier pour le dernier dossier sur une carte officine (évite « Clôturées » ambigu). */
function lastDossierStatusHintFr(status: string | null): string | null {
  const label = lastRequestStatusLabelFr(status);
  if (!label) return null;
  if (label === "Clôturées") return "Clôturé";
  if (label === "Envoyées") return "Envoyée";
  if (label === "Annulées") return "Annulé";
  if (label === "Expirées") return "Expiré";
  if (label === "Abandonnées") return "Abandonné";
  if (label.endsWith("ées")) return `${label.slice(0, -2)}ée`;
  if (label.endsWith("és")) return `${label.slice(0, -1)}é`;
  return label;
}

function pharmacyCardActivityLineFr(
  lastActivityAt: string | null,
  lastStatus: string | null,
  activeCount: number
): string {
  const when = formatActivityFr(lastActivityAt);
  if (activeCount > 0) {
    return `Dernière activité : ${when}`;
  }
  const dossier = lastDossierStatusHintFr(lastStatus);
  if (dossier) {
    return `Dernier dossier (${dossier}) · ${when}`;
  }
  return `Dernière activité : ${when}`;
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
  const [rows, setRows] = useState<PatientPharmacyDirectoryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("activity");
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(async () => {
    setError("");
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
      const rpcMissing =
        rpcErr.message.includes("patient_pharmacy_directory_enriched") ||
        rpcErr.code === "PGRST202";
      if (rpcMissing) {
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
    <PageShell maxWidthClass="max-w-5xl" className={clsx("space-y-5", p.page)}>
      <PatientAccountPageHeader
        eyebrow="Espace patient"
        title="Mes pharmacies"
        subtitle="Officines avec lesquelles vous avez déjà échangé (demandes, ordonnances, consultations ou packs promo)."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={p.statCard}>
          <p className={p.statLabel}>Total</p>
          <p className={p.statValue}>{stats.total}</p>
        </div>
        <div className={p.statCard}>
          <p className={p.statLabel}>Dossiers en cours</p>
          <p className={p.statValue}>{stats.withActive}</p>
        </div>
        <div className={p.statCard}>
          <p className={p.statLabel}>Avec pack promo</p>
          <p className={p.statValue}>{stats.withPromo}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recherche
          <span className="relative block">
            <Search
              className={clsx(
                "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2",
                p.searchIcon
              )}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Nom, ville, code officine…"
              className={clsx(
                "w-full rounded-lg border bg-background py-2 pl-8 pr-2 text-xs font-normal normal-case tracking-normal text-foreground outline-none focus-visible:ring-2",
                p.searchInput
              )}
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
      {rows.length === 0 && !error ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <MapPin className="mx-auto mb-2 h-8 w-8 text-primary/50" />
          Aucune pharmacie pour l’instant. Parcourez l’annuaire pour contacter une officine.
          <Link href="/" className={clsx("mt-3 block", p.link)}>
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
            const activityLine = pharmacyCardActivityLineFr(
              r.last_activity_at,
              r.last_request_status,
              r.active_request_count
            );
            return (
              <li key={r.pharmacy_id}>
                <div
                  className={clsx(
                    "group flex flex-col rounded-xl border border-border bg-card shadow-sm",
                    p.cardHover
                  )}
                >
                  <Link
                    href={`/dashboard/patient/pharmacies/${r.pharmacy_id}`}
                    className="flex flex-col rounded-t-xl p-3 pb-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {r.pharmacy_public_ref?.trim() ? (
                          <p className={clsx("font-mono text-[11px] font-bold", p.monoAccent)}>{r.pharmacy_public_ref.trim()}</p>
                        ) : null}
                        <p className="truncate font-semibold text-foreground">{pharmacyDisplayName(r.nom)}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {r.ville?.trim() ? `${r.ville.trim()} · ` : ""}
                          {r.adresse?.trim() || "—"}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{pharmacyKindLabelsFr(r.request_kinds)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
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
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-500" />
                          {rating}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-2 text-[10px] text-muted-foreground">{activityLine}</p>
                  </Link>

                  {wa || r.telephone ? (
                    <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={clsx("inline-flex items-center gap-1 text-[11px]", p.linkInline)}
                        >
                          <MessageSquare className="h-3 w-3" />
                          WhatsApp
                        </a>
                      ) : null}
                      {r.telephone ? (
                        <a
                          href={`tel:${r.telephone}`}
                          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
                          {r.telephone}
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
