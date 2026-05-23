"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { loadPharmacistPharmacyId } from "@/lib/pharmacy-staff-context";
import { supabase } from "@/lib/supabase";
import { rowMatchesPublicRefQuery } from "@/lib/public-ref";
import { PROMO_RESERVATION_BUCKETS, promoReservationBadgeClass, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";

type Row = {
  id: string;
  status: PromoReservationStatus;
  pickup_date: string;
  pickup_time: string | null;
  public_ref: string | null;
  updated_at: string;
  offer: { title: string } | null;
  patient: { full_name: string | null } | null;
};

function formatPickupShort(date: string, time: string | null) {
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return time ? `${d} · ${time.slice(0, 5)}` : d;
}

export function PharmacistPromoReservationsHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    const ctx = await loadPharmacistPharmacyId();
    if (!ctx.pharmacyId) {
      setError(ctx.error ?? "Erreur");
      setLoading(false);
      return;
    }
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace("/auth?redirect=/dashboard/pharmacien/reservations-packs");
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pharmacy_promo_reservations")
      .select(
        "id,status,pickup_date,pickup_time,public_ref,updated_at,pharmacy_promo_offers(title),profiles:patient_id(full_name)"
      )
      .eq("pharmacy_id", ctx.pharmacyId)
      .order("updated_at", { ascending: false });
    if (qErr) setError(qErr.message);
    else {
      setRows(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          status: r.status as PromoReservationStatus,
          pickup_date: r.pickup_date as string,
          pickup_time: r.pickup_time as string | null,
          public_ref: r.public_ref as string | null,
          updated_at: r.updated_at as string,
          offer: r.pharmacy_promo_offers as Row["offer"],
          patient: r.profiles as Row["patient"],
        }))
      );
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filteredRows = useMemo(() => {
    if (searchQuery.trim().length < 2) return rows;
    return rows.filter((r) =>
      rowMatchesPublicRefQuery(searchQuery, [
        r.public_ref,
        r.offer?.title,
        r.patient?.full_name,
      ])
    );
  }, [rows, searchQuery]);

  const submittedCount = useMemo(() => rows.filter((r) => r.status === "submitted").length, [rows]);

  const byBucket = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const b of PROMO_RESERVATION_BUCKETS) map.set(b.key, []);
    for (const r of filteredRows) {
      const bucket = PROMO_RESERVATION_BUCKETS.find((b) => b.statuses.includes(r.status));
      if (bucket) map.get(bucket.key)!.push(r);
    }
    return map;
  }, [filteredRows]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/dashboard/pharmacien" className="text-xs font-medium text-sky-800 underline">
            ← Tableau de bord
          </Link>
          <h1 className="mt-2 text-lg font-bold">Réservations packs</h1>
          <p className="text-xs text-muted-foreground">Demandes de réservation sur vos offres promo publiées.</p>
        </div>
        <Link
          href="/dashboard/pharmacien/offres-promos"
          className="shrink-0 rounded-md border px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-muted/50"
        >
          Offres et promos
        </Link>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

      {submittedCount > 0 ? (
        <p className="rounded-xl bg-sky-50 px-3 py-2 text-sm font-medium text-sky-950 ring-1 ring-sky-100">
          {submittedCount} réservation{submittedCount > 1 ? "s" : ""} en attente de votre réponse.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <label className="flex max-w-md flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Recherche (réf., pack, patient)
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Ex. P042/26"
            className="rounded-md border px-2 py-1.5 text-xs font-normal normal-case tracking-normal"
          />
        </label>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune réservation pour le moment.
        </p>
      ) : (
        PROMO_RESERVATION_BUCKETS.map((bucket) => {
          const list = byBucket.get(bucket.key) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={bucket.key} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {bucket.label} ({list.length})
              </h2>
              {list.map((r) => (
                <Link key={r.id} href={`/dashboard/pharmacien/reservations-packs/${r.id}`} className="block">
                  <CompactCard>
                    <CompactCardBody className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold">{r.offer?.title ?? "Pack"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.patient?.full_name?.trim() || "Patient"} · {formatPickupShort(r.pickup_date, r.pickup_time)}
                        </p>
                        {r.public_ref ? (
                          <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{r.public_ref}</p>
                        ) : null}
                      </div>
                      <span
                        className={clsx(
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                          promoReservationBadgeClass(r.status)
                        )}
                      >
                        {promoReservationLabel(r.status, "pharmacien")}
                      </span>
                    </CompactCardBody>
                  </CompactCard>
                </Link>
              ))}
            </section>
          );
        })
      )}
    </PageShell>
  );
}
