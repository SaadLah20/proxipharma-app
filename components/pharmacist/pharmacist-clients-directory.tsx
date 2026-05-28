"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ChevronRight, Gift, Mail, MessageSquare, Package, Phone, Search, Users } from "lucide-react";
import { PageShell } from "@/components/ui/compact-shell";
import {
  formatActivityFr,
  requestKindLabelsFr,
  type PharmacistPatientDirectoryRow,
  whatsappHref,
} from "@/lib/pharmacist-patient-crm";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { formatShortId } from "@/lib/request-display";
import { supabase } from "@/lib/supabase";

type SortKey = "activity" | "name" | "active";

function mapLegacyDirectory(rows: { patient_id: string; full_name: string | null; whatsapp: string | null; email: string | null; patient_ref: string | null }[]): PharmacistPatientDirectoryRow[] {
  return rows.map((r) => ({
    patient_id: r.patient_id,
    full_name: r.full_name,
    whatsapp: r.whatsapp,
    email: r.email,
    patient_ref: r.patient_ref,
    request_count: 0,
    active_request_count: 0,
    promo_reservation_count: 0,
    last_activity_at: null,
    last_request_status: null,
    request_kinds: [],
  }));
}

export function PharmacistClientsDirectory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [migrationNote, setMigrationNote] = useState("");
  const [rows, setRows] = useState<PharmacistPatientDirectoryRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("activity");
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setMigrationNote("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/clients");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "pharmacien") {
      setError("Cet écran est réservé aux pharmaciens.");
      setLoading(false);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("pharmacist_patient_directory_enriched_for_my_pharmacy");

    if (rpcErr) {
      if (rpcErr.message.includes("pharmacist_patient_directory_enriched")) {
        setMigrationNote(
          "Liste enrichie indisponible : appliquez `20260616_001_pharmacist_dashboard_patient_crm.sql`. Affichage simplifié."
        );
        const { data: legacy, error: legErr } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
        if (legErr) setError(legErr.message);
        else setRows(mapLegacyDirectory((legacy ?? []) as Parameters<typeof mapLegacyDirectory>[0]));
      } else {
        setError(rpcErr.message);
      }
    } else {
      setRows((data ?? []) as PharmacistPatientDirectoryRow[]);
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
          r.patient_ref,
          r.full_name,
          r.email,
          r.whatsapp,
          formatShortId(r.patient_id),
        ])
      );
    }
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "fr"));
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
    const activePatients = rows.filter((r) => r.active_request_count > 0).length;
    const withPromo = rows.filter((r) => r.promo_reservation_count > 0).length;
    return { total: rows.length, activePatients, withPromo };
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/pharmacien" className="text-xs font-medium text-emerald-900 underline">
            ← Tableau de bord
          </Link>
          <h1 className="mt-2 text-xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Patients ayant interagi avec votre officine (demandes ou réservations promo).
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Dossiers actifs</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">{stats.activePatients}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Avec pack promo</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-violet-900">{stats.withPromo}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recherche
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Code client, nom, téléphone…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-8 pr-2 text-xs font-normal normal-case tracking-normal text-foreground"
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
            Actifs seulement
          </label>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {migrationNote && !error ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">{migrationNote}</p>
      ) : null}

      {rows.length === 0 && !error ? (
        <p className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
          Aucun client pour l’instant. Les patients apparaîtront après une demande ou une réservation promo.
        </p>
      ) : filteredRows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Aucun client ne correspond à ces critères.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {filteredRows.map((r) => {
            const wa = whatsappHref(r.whatsapp);
            return (
              <li key={r.patient_id}>
                <div className="group flex flex-col rounded-xl border border-border bg-card shadow-sm transition hover:border-primary/25 hover:shadow-md">
                  <Link
                    href={`/dashboard/pharmacien/clients/${r.patient_id}`}
                    className="flex flex-col rounded-t-xl p-3 pb-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {r.patient_ref?.trim() ? (
                          <p className="font-mono text-[11px] font-bold text-emerald-900">{r.patient_ref.trim()}</p>
                        ) : null}
                        <p className="truncate font-semibold text-foreground">{r.full_name?.trim() || "Patient"}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {requestKindLabelsFr(r.request_kinds)}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.active_request_count > 0 ? (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
                          <Package className="h-3 w-3" />
                          {r.active_request_count} actif{r.active_request_count > 1 ? "s" : ""}
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
                    </div>

                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Dernière activité : {formatActivityFr(r.last_activity_at)}
                    </p>
                  </Link>

                  {wa || r.whatsapp || r.email ? (
                    <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 underline"
                        >
                          <MessageSquare className="h-3 w-3" />
                          WhatsApp
                        </a>
                      ) : null}
                      {r.whatsapp ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {r.whatsapp}
                        </span>
                      ) : null}
                      {r.email ? (
                        <span className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          {r.email}
                        </span>
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
