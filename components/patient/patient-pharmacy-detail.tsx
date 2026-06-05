"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ExternalLink,
  Gift,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Star,
  Store,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/compact-shell";
import { PATIENT_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { formatDateTimeForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import type { PromoReservationStatus } from "@/lib/promo/types";
import {
  parsePatientPharmacyDetail,
  patientPromoDetailPath,
  patientRequestDetailPath,
  pharmacyDisplayName,
  pharmacyRatingLabelFr,
  pharmacyWhatsAppHref,
  promoStatusLabelFr,
  type PatientPharmacyDetail,
} from "@/lib/patient-pharmacy-crm";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { clsx } from "clsx";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { supabase } from "@/lib/supabase";

function requestStatusLabelFr(status: string): string {
  const bucket = PATIENT_DASHBOARD_BUCKETS.find((b) => b.statuses.includes(status));
  if (bucket) return bucket.label;
  return status;
}

const ACTIVE_STATUSES = new Set(["submitted", "in_review", "responded", "confirmed", "treated"]);

export function PatientPharmacyDetail({ pharmacyId }: { pharmacyId: string }) {
  const router = useRouter();
  const t = useTranslations("account");
  const tp = useTranslations("promo");
  const tpp = useTranslations("pharmacyPublic");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<PatientPharmacyDetail | null>(null);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace(`/auth?redirect=/dashboard/patient/pharmacies/${pharmacyId}`);
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "patient") {
      setError(t("patientsAccessOnly"));
      setLoading(false);
      return;
    }

    const { data, error: rpcErr } = await supabase.rpc("patient_pharmacy_detail", {
      p_pharmacy_id: pharmacyId,
    });

    if (rpcErr) {
      const rpcMissing =
        rpcErr.message.includes("patient_pharmacy_detail") || rpcErr.code === "PGRST202";
      setError(
        rpcMissing
          ? t("pharmacyDetailUnavailable")
          : rpcErr.message
      );
      setDetail(null);
    } else {
      const parsed = parsePatientPharmacyDetail(data);
      if (!parsed) {
        setError(t("pharmacyNotLinked"));
      } else {
        setDetail(parsed);
      }
    }
    setLoading(false);
  }, [router, pharmacyId]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const activeRequests = useMemo(
    () => detail?.requests.filter((r) => ACTIVE_STATUSES.has(r.status)) ?? [],
    [detail]
  );

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </PageShell>
    );
  }

  if (error || !detail) {
    return (
      <PageShell maxWidthClass="max-w-3xl" className="space-y-4">
        <Link href="/dashboard/patient/pharmacies" className={p.backLink}>
          {t("backToPharmacies")}
        </Link>
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error || t("pharmacyNotLinked")}</p>
      </PageShell>
    );
  }

  const { pharmacy } = detail;
  const wa = pharmacyWhatsAppHref(pharmacy.whatsapp);
  const rating = pharmacyRatingLabelFr(pharmacy.rating_avg, pharmacy.rating_count);
  const publicProfileHref = `/pharmacie/${pharmacy.pharmacy_id}`;
  const newProductRequestHref = `/pharmacie/${pharmacy.pharmacy_id}/demande-produits`;

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-5">
      <Link href="/dashboard/patient/pharmacies" className={p.backLink}>
        {t("backToPharmacies")}
      </Link>

      <header className={p.hero}>
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 shadow-inner">
            <Store className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            {pharmacy.pharmacy_public_ref?.trim() ? (
              <p className="font-mono text-xs font-bold text-primary-foreground/95">
                {pharmacy.pharmacy_public_ref.trim()}
              </p>
            ) : null}
            <h1 className="text-lg font-bold leading-tight">{pharmacyDisplayName(pharmacy.nom)}</h1>
            <p className={clsx("mt-1 flex items-start gap-1 text-xs", p.heroSubtitle)}>
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {pharmacy.ville?.trim() ? `${pharmacy.ville.trim()} · ` : ""}
                {pharmacy.adresse?.trim() || t("addressMissing")}
              </span>
            </p>
            {rating ? (
              <p className={clsx("mt-1 inline-flex items-center gap-1 text-xs", p.heroSubtitle)}>
                <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                {rating}
              </p>
            ) : null}
            <p className={clsx("mt-2 text-xs", p.heroSubtitle)}>
              {detail.requests.length === 1
                ? t("requestCount", { count: detail.requests.length })
                : t("requestCountPlural", { count: detail.requests.length })}
              {detail.promo_reservations.length > 0
                ? ` · ${
                    detail.promo_reservations.length === 1
                      ? t("promoReservationCount", { count: detail.promo_reservations.length })
                      : t("promoReservationCountPlural", { count: detail.promo_reservations.length })
                  }`
                : ""}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={publicProfileHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-foreground px-3 py-2 text-xs font-semibold text-primary shadow-sm hover:opacity-95"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("publicProfile")}
          </Link>
          <Link
            href={newProductRequestHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
          >
            <Package className="h-3.5 w-3.5" />
            {t("newProductRequest")}
          </Link>
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {tpp("whatsapp")}
            </a>
          ) : null}
          {pharmacy.telephone ? (
            <a
              href={`tel:${pharmacy.telephone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <Phone className="h-3.5 w-3.5" />
              {tpp("call")}
            </a>
          ) : null}
        </div>
      </header>

      {activeRequests.length > 0 ? (
        <section className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 ring-1 ring-amber-100/60">
          <h2 className="text-xs font-bold uppercase tracking-wide text-amber-950">{t("activeDossiers")}</h2>
          <ul className="mt-2 space-y-1.5">
            {activeRequests.slice(0, 8).map((r) => (
              <li key={r.id}>
                <Link
                  href={patientRequestDetailPath(r.request_type, r.id)}
                  className="flex items-center justify-between gap-2 rounded-lg bg-background/80 px-2.5 py-2 text-sm hover:bg-background"
                >
                  <span className="min-w-0 truncate font-medium">
                    {r.request_public_ref?.trim() ||
                      getRequestKindConfig(r.request_type).theme.headerLabelShort}
                  </span>
                  <span className="shrink-0 text-[11px] text-amber-900">{requestStatusLabelFr(r.status)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-primary" />
            {t("requestHistory")}
          </h2>
        </div>
        {detail.requests.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("noRequestsWithPharmacy")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {detail.requests.map((r) => (
              <li key={r.id}>
                <Link
                  href={patientRequestDetailPath(r.request_type, r.id)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {r.request_public_ref?.trim() ||
                        getRequestKindConfig(r.request_type).theme.headerLabelShort}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {getRequestKindConfig(r.request_type).theme.headerLabelShort} ·{" "}
                      {requestStatusLabelFr(r.status)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t("updatedAt", {
                        when: formatDateTimeForLocale(r.updated_at, locale, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        }),
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail.promo_reservations.length > 0 ? (
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gift className="h-4 w-4 text-violet-700" />
              {t("promoReservations")}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {detail.promo_reservations.map((pr) => (
              <li key={pr.id}>
                <Link
                  href={patientPromoDetailPath(pr.id)}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {pr.public_ref?.trim() || t("promoReservationFallback")}
                      {pr.offer_title ? (
                        <span className="ml-1 font-normal text-muted-foreground">· {pr.offer_title}</span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {promoPatientStatusLabel(tp, pr.status as PromoReservationStatus)} · {t("pickup")}{" "}
                      {formatDateTimeForLocale(pr.pickup_date, locale, { timeZone: "Africa/Casablanca" })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/dashboard/patient/packs-promo" className={p.linkInline}>
          {t("allPromoReservations")}
        </Link>
      </p>
    </PageShell>
  );
}
