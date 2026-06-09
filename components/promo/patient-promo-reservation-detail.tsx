"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { PageShell } from "@/components/ui/compact-shell";
import { DossierInlineActionPanel } from "@/components/requests/dossier-inline-action-panel";
import { PatientPromoReservationDossierHeader } from "@/components/promo/patient-promo-reservation-dossier-header";
import { PromoReservationHistoryPanel } from "@/components/promo/promo-reservation-history-panel";
import type { PatientPharmacyContactInfo } from "@/components/requests/product/patient-pharmacy-quick-contact";
import { formatDateForLocale, formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import type { AppLocale } from "@/lib/i18n/config";
import { promoPatientStatusHint, promoPatientStatusLabel } from "@/lib/i18n/promo-patient-status";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import {
  patientPromoReservationDossierSectionShellClass,
} from "@/lib/patient-promo-reservation-line-ui";
import {
  isPromoReservationTerminalStatus,
  type PromoReservationHistoryRow,
} from "@/lib/promo/promo-reservation-history-labels";
import { PromoOfferPackDossierSection } from "@/components/promo/promo-offer-description-panel";
import { PromoOfferPackSummary } from "@/components/promo/promo-offer-pack-summary";
import { fetchPromoOfferLines } from "@/lib/promo/load-offer-lines";
import { markPromoReservationNotificationsRead } from "@/lib/promo/mark-reservation-notifs-read";
import {
  PROMO_RESERVATION_DETAIL_REFRESH_EVENT,
  type PromoReservationDetailRefreshDetail,
} from "@/lib/request-detail-refresh-bus";
import { supabase } from "@/lib/supabase";
import { uiActionBtnFullDestructive } from "@/lib/ui-action-buttons";
import type { PromoLineWithPrice } from "@/lib/promo/pricing";
import type { PromoReservationStatus } from "@/lib/promo/types";

export function PatientPromoReservationDetail({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const t = useTranslations("promo");
  const ta = useTranslations("account");
  const tc = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<PromoLineWithPrice[]>([]);
  const [historyRows, setHistoryRows] = useState<PromoReservationHistoryRow[]>([]);
  const [row, setRow] = useState<{
    id: string;
    offer_id: string;
    status: PromoReservationStatus;
    pickup_date: string;
    pickup_time: string | null;
    patient_note: string | null;
    pharmacist_note: string | null;
    public_ref: string | null;
    created_at: string;
    offer: { title: string; discount_percent: number; description: string | null } | null;
    pharmacy: PatientPharmacyContactInfo & { id: string } | null;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryBusy(true);
    const { data } = await supabase
      .from("pharmacy_promo_reservation_status_history")
      .select("id,old_status,new_status,note,created_at")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false });
    setHistoryRows((data ?? []) as PromoReservationHistoryRow[]);
    setHistoryBusy(false);
  }, [reservationId]);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      router.replace(`/auth?redirect=/dashboard/patient/packs-promo/${reservationId}`);
      return;
    }
    const { data, error: qErr } = await supabase
      .from("pharmacy_promo_reservations")
      .select(
        "id,offer_id,status,pickup_date,pickup_time,patient_note,pharmacist_note,public_ref,created_at,pharmacy_promo_offers(title,description,discount_percent),pharmacies:pharmacy_id(id,nom,nom_ar,ville,adresse,adresse_ar,telephone,contact_email,public_ref,latitude,longitude,maps_url)",
      )
      .eq("id", reservationId)
      .maybeSingle();
    if (qErr || !data) {
      setError(qErr?.message ?? t("notFound"));
      setRow(null);
      setLines([]);
      setHistoryRows([]);
    } else {
      const r = data as Record<string, unknown>;
      const offerId = r.offer_id as string;
      const ph = r.pharmacies as Record<string, unknown> | null;
      setRow({
        id: r.id as string,
        offer_id: offerId,
        status: r.status as PromoReservationStatus,
        pickup_date: r.pickup_date as string,
        pickup_time: r.pickup_time as string | null,
        patient_note: r.patient_note as string | null,
        pharmacist_note: r.pharmacist_note as string | null,
        public_ref: r.public_ref as string | null,
        created_at: r.created_at as string,
        offer: r.pharmacy_promo_offers as {
          title: string;
          discount_percent: number;
          description: string | null;
        } | null,
        pharmacy: ph
          ? {
              id: ph.id as string,
              nom: (ph.nom as string) ?? "",
              nom_ar: (ph.nom_ar as string) ?? null,
              ville: (ph.ville as string) ?? null,
              adresse: (ph.adresse as string) ?? null,
              adresse_ar: (ph.adresse_ar as string) ?? null,
              telephone: (ph.telephone as string) ?? null,
              contact_email: (ph.contact_email as string) ?? null,
              public_ref: (ph.public_ref as string) ?? null,
              latitude: (ph.latitude as number) ?? null,
              longitude: (ph.longitude as number) ?? null,
              maps_url: (ph.maps_url as string) ?? null,
            }
          : null,
      });
      setLines(await fetchPromoOfferLines(offerId));
      void markPromoReservationNotificationsRead(reservationId);
      await loadHistory();
    }
    setLoading(false);
  }, [reservationId, router, t, loadHistory]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    const listener = (ev: Event) => {
      const detail = (ev as CustomEvent<PromoReservationDetailRefreshDetail>).detail;
      if (detail?.reservationId !== reservationId) return;
      void load();
    };
    window.addEventListener(PROMO_RESERVATION_DETAIL_REFRESH_EVENT, listener);
    return () => window.removeEventListener(PROMO_RESERVATION_DETAIL_REFRESH_EVENT, listener);
  }, [reservationId, load]);

  const cancel = async () => {
    if (!row || !["submitted", "confirmed"].includes(row.status)) return;
    if (!window.confirm(t("cancelConfirm"))) return;
    setBusy(true);
    setError("");
    const { error: rpcErr } = await supabase.rpc("cancel_promo_reservation", {
      p_reservation_id: reservationId,
      p_note: null,
    });
    setBusy(false);
    if (rpcErr) setError(rpcErr.message);
    else await load();
  };

  const canCancel = row && ["submitted", "confirmed"].includes(row.status);

  if (loading) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </PageShell>
    );
  }

  if (!row) {
    return (
      <PageShell maxWidthClass="max-w-3xl">
        <Link href="/dashboard/patient/packs-promo" className={p.backLink}>
          {ta("backToPromoHub")}
        </Link>
        <p className="mt-4 text-sm text-red-800">{error || t("notFound")}</p>
      </PageShell>
    );
  }

  const pickupLabel = formatDateForLocale(`${row.pickup_date}T12:00:00`, locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const dossierRefLabel = row.public_ref?.trim() || row.id.slice(0, 8);
  const terminal = isPromoReservationTerminalStatus(row.status);
  const terminalEntry = terminal ? historyRows[0] : null;

  return (
    <PageShell maxWidthClass="max-w-3xl" className="space-y-3 bg-slate-50">
      <Link href="/dashboard/patient/packs-promo" className={p.backLink}>
        {ta("backToPromoHub")}
      </Link>

      <section
        className={clsx(
          "min-w-0 w-full max-w-full space-y-3 overflow-x-hidden rounded-xl border-2 p-2.5 sm:p-3",
          patientPromoReservationDossierSectionShellClass,
        )}
      >
        {row.pharmacy?.id ? (
          <PatientPromoReservationDossierHeader
            dossierRefLabel={dossierRefLabel}
            pharmacyContact={row.pharmacy}
            pharmacyId={row.pharmacy.id}
            status={row.status}
            statusLabel={promoPatientStatusLabel(t, row.status)}
            statusHint={promoPatientStatusHint(t, row.status, {
              pharmacistMessage: Boolean(row.pharmacist_note?.trim()),
            })}
            reservedAt={row.created_at}
            createdAt={row.created_at}
          />
        ) : null}

        {["unavailable", "cancelled", "confirmed"].includes(row.status) && row.pharmacist_note?.trim() ? (
          <div
            className={clsx(
              "rounded-xl border px-3 py-2.5 text-sm",
              row.status === "confirmed"
                ? "border-emerald-200/60 bg-emerald-50/50 text-emerald-950"
                : "border-rose-200 bg-rose-50/50 text-rose-950",
            )}
          >
            <p className="text-[10px] font-bold uppercase">{t("pharmacyMessage")}</p>
            <p className="mt-1 leading-snug">{row.pharmacist_note.trim()}</p>
          </div>
        ) : null}

        <PromoOfferPackDossierSection
          title={row.offer?.title ?? t("packFallback")}
          description={row.offer?.description}
          descriptionLabel={t("packDescription")}
          kindLabel={t("packFallback")}
          discountPercent={row.offer?.discount_percent ?? 0}
        >
          <PromoOfferPackSummary
            lines={lines}
            discountPercent={row.offer?.discount_percent ?? 0}
            variant="detail"
          />
        </PromoOfferPackDossierSection>

        <dl className="space-y-2 rounded-xl border border-emerald-200/40 bg-card/80 p-3 text-sm ring-1 ring-emerald-100/25">
          <div>
            <dt className="text-[10px] font-bold uppercase text-muted-foreground">{t("visitDate")}</dt>
            <dd>
              {pickupLabel}
              {row.pickup_time ? ` · ${row.pickup_time.slice(0, 5)}` : ""}
            </dd>
          </div>
          {row.patient_note?.trim() ? (
            <div>
              <dt className="text-[10px] font-bold uppercase text-muted-foreground">{t("yourMessage")}</dt>
              <dd className="text-muted-foreground">{row.patient_note.trim()}</dd>
            </div>
          ) : null}
        </dl>

        {error ? <p className="text-sm text-red-800">{error}</p> : null}

        {terminal && terminalEntry?.created_at ? (
          <p className="border-t border-border/60 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
            {t("archiveClosedOn")}{" "}
            <time dateTime={terminalEntry.created_at} className="font-semibold tabular-nums text-foreground">
              {formatDateTimeShortForLocale(terminalEntry.created_at, locale)}
            </time>
          </p>
        ) : null}
      </section>

      {canCancel ? (
        <DossierInlineActionPanel tone="emerald">
          <button
            type="button"
            disabled={busy}
            className={uiActionBtnFullDestructive()}
            onClick={() => void cancel()}
          >
            {busy ? t("cancelling") : t("cancelReservation")}
          </button>
        </DossierInlineActionPanel>
      ) : null}

      <PromoReservationHistoryPanel
        rows={historyRows}
        role="patient"
        busy={historyBusy}
        onRefresh={() => void loadHistory()}
      />
    </PageShell>
  );
}
