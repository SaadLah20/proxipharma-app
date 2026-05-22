"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";
import { promoReservationBadgeClass, promoReservationHint, promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";

type Row = {
  id: string;
  status: PromoReservationStatus;
  pickup_date: string;
  pickup_time: string | null;
  public_ref: string | null;
  updated_at: string;
  offer: { title: string; discount_percent: number } | null;
  pharmacy: { nom: string } | null;
};

function formatPickupFr(date: string, time: string | null) {
  const d = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (!time) return d;
  const t = time.slice(0, 5);
  return `${d} · ${t}`;
}

export function PatientPromoReservationsHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace("/auth?redirect=/dashboard/patient/packs-promo");
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pharmacy_promo_reservations")
      .select(
        "id,status,pickup_date,pickup_time,public_ref,updated_at,pharmacy_promo_offers(title,discount_percent),pharmacies:pharmacy_id(nom)"
      )
      .order("updated_at", { ascending: false });
    if (qErr) {
      setError(qErr.message);
      setRows([]);
    } else {
      setRows(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          status: r.status as PromoReservationStatus,
          pickup_date: r.pickup_date as string,
          pickup_time: r.pickup_time as string | null,
          public_ref: r.public_ref as string | null,
          updated_at: r.updated_at as string,
          offer: r.pharmacy_promo_offers as Row["offer"],
          pharmacy: r.pharmacies as Row["pharmacy"],
        }))
      );
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const active = useMemo(() => rows.filter((r) => !["collected", "cancelled", "unavailable"].includes(r.status)), [rows]);
  const done = useMemo(() => rows.filter((r) => ["collected", "cancelled", "unavailable"].includes(r.status)), [rows]);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
      <div>
        <Link href="/dashboard/patient/pharmacies" className="text-xs font-medium text-sky-800 underline">
          ← Mes pharmacies
        </Link>
        <h1 className="mt-2 text-lg font-bold">Mes packs promo</h1>
        <p className="text-xs text-muted-foreground">
          Réservations de packs promotionnels auprès de vos officines.
        </p>
      </div>
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Aucune réservation pour le moment. Réservez un pack depuis l&apos;onglet Offres d&apos;une pharmacie.
        </p>
      ) : null}
      {active.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">En cours</h2>
          {active.map((r) => (
            <ReservationCard key={r.id} row={r} />
          ))}
        </section>
      ) : null}
      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Historique</h2>
          {done.map((r) => (
            <ReservationCard key={r.id} row={r} />
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

function ReservationCard({ row }: { row: Row }) {
  return (
    <Link href={`/dashboard/patient/packs-promo/${row.id}`} className="block">
      <CompactCard>
        <CompactCardBody className="space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">{row.offer?.title ?? "Pack promo"}</p>
              <p className="text-[11px] text-muted-foreground">{row.pharmacy?.nom ?? "Pharmacie"}</p>
            </div>
            <span
              className={clsx(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                promoReservationBadgeClass(row.status)
              )}
            >
              {promoReservationLabel(row.status, "patient")}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{promoReservationHint(row.status)}</p>
          <div className="flex flex-wrap gap-x-3 text-[10px] tabular-nums text-muted-foreground">
            {row.public_ref ? <span>{row.public_ref}</span> : null}
            <span>Passage : {formatPickupFr(row.pickup_date, row.pickup_time)}</span>
            {row.offer?.discount_percent ? <span>−{row.offer.discount_percent} %</span> : null}
          </div>
        </CompactCardBody>
      </CompactCard>
    </Link>
  );
}
