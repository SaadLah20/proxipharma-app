"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { PageShell, CompactCard, CompactCardBody } from "@/components/ui/compact-shell";
import { formatDateForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { promoPatientStatusHint, promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";
import { promoReservationBadgeClass } from "@/lib/promo/reservation-status-ui";
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

function formatPickup(date: string, time: string | null, locale: AppLocale) {
  const d = formatDateForLocale(`${date}T12:00:00`, locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (!time) return d;
  return `${d} · ${time.slice(0, 5)}`;
}

export function PatientPromoReservationsHub() {
  const router = useRouter();
  const t = useTranslations("promo");
  const ta = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
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
      />
      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground space-y-2">
          <p>{t("empty")}</p>
          <Link href="/dashboard/patient/pharmacies" className={p.linkInline}>
            {t("findPharmacy")}
          </Link>
        </div>
      ) : null}
      {active.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("activeSection")}</h2>
          {active.map((r) => (
            <ReservationCard key={r.id} row={r} locale={locale} />
          ))}
        </section>
      ) : null}
      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("historySection")}</h2>
          {done.map((r) => (
            <ReservationCard key={r.id} row={r} locale={locale} />
          ))}
        </section>
      ) : null}
    </PageShell>
  );
}

function ReservationCard({ row, locale }: { row: Row; locale: AppLocale }) {
  const t = useTranslations("promo");
  const when = formatPickup(row.pickup_date, row.pickup_time, locale);

  return (
    <Link href={`/dashboard/patient/packs-promo/${row.id}`} className="block">
      <CompactCard>
        <CompactCardBody className="space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold">{row.offer?.title ?? t("packFallback")}</p>
              <p className="text-[11px] text-muted-foreground">{row.pharmacy?.nom ?? t("pharmacyFallback")}</p>
            </div>
            <span
              className={clsx(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                promoReservationBadgeClass(row.status)
              )}
            >
              {promoPatientStatusLabel(t, row.status)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">{promoPatientStatusHint(t, row.status)}</p>
          <div className="flex flex-wrap gap-x-3 text-[10px] tabular-nums text-muted-foreground">
            {row.public_ref ? <span>{row.public_ref}</span> : null}
            <span>{t("visit", { when })}</span>
            {row.offer?.discount_percent ? <span>−{row.offer.discount_percent} %</span> : null}
          </div>
        </CompactCardBody>
      </CompactCard>
    </Link>
  );
}
