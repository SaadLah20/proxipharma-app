import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";
import type { AppLocale } from "@/lib/i18n/config";
import { formatDateTimeShortForLocale } from "@/lib/datetime-locale";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";

export type PatientPharmacyDirectoryRow = {
  pharmacy_id: string;
  nom: string | null;
  nom_ar?: string | null;
  ville: string | null;
  adresse: string | null;
  telephone: string | null;
  whatsapp: string | null;
  pharmacy_public_ref: string | null;
  rating_avg: number | null;
  rating_count: number | null;
  request_count: number;
  active_request_count: number;
  promo_reservation_count: number;
  last_activity_at: string | null;
  last_request_status: string | null;
  request_kinds: string[];
};

export type PatientPharmacyDetailRequest = {
  id: string;
  request_type: string;
  status: string;
  request_public_ref: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  responded_at: string | null;
};

export type PatientPharmacyDetailPromo = {
  id: string;
  status: string;
  public_ref: string | null;
  pickup_date: string;
  created_at: string;
  updated_at: string;
  offer_title: string | null;
};

export type PatientPharmacyDetail = {
  pharmacy: {
    pharmacy_id: string;
    nom: string | null;
    nom_ar?: string | null;
    ville: string | null;
    adresse: string | null;
    adresse_ar?: string | null;
    telephone: string | null;
    whatsapp: string | null;
    pharmacy_public_ref: string | null;
    rating_avg: number | null;
    rating_count: number | null;
  };
  requests: PatientPharmacyDetailRequest[];
  promo_reservations: PatientPharmacyDetailPromo[];
};

export function parsePatientPharmacyDetail(raw: unknown): PatientPharmacyDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pharmacy = o.pharmacy as Record<string, unknown> | undefined;
  if (!pharmacy?.pharmacy_id) return null;
  return {
    pharmacy: {
      pharmacy_id: String(pharmacy.pharmacy_id),
      nom: pharmacy.nom != null ? String(pharmacy.nom) : null,
      nom_ar: pharmacy.nom_ar != null ? String(pharmacy.nom_ar) : null,
      ville: pharmacy.ville != null ? String(pharmacy.ville) : null,
      adresse: pharmacy.adresse != null ? String(pharmacy.adresse) : null,
      adresse_ar: pharmacy.adresse_ar != null ? String(pharmacy.adresse_ar) : null,
      telephone: pharmacy.telephone != null ? String(pharmacy.telephone) : null,
      whatsapp: pharmacy.whatsapp != null ? String(pharmacy.whatsapp) : null,
      pharmacy_public_ref:
        pharmacy.pharmacy_public_ref != null ? String(pharmacy.pharmacy_public_ref) : null,
      rating_avg:
        pharmacy.rating_avg != null && pharmacy.rating_avg !== ""
          ? Number(pharmacy.rating_avg)
          : null,
      rating_count:
        pharmacy.rating_count != null ? Number(pharmacy.rating_count) : null,
    },
    requests: Array.isArray(o.requests)
      ? (o.requests as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          request_type: String(r.request_type),
          status: String(r.status),
          request_public_ref: r.request_public_ref != null ? String(r.request_public_ref) : null,
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
          submitted_at: r.submitted_at != null ? String(r.submitted_at) : null,
          responded_at: r.responded_at != null ? String(r.responded_at) : null,
        }))
      : [],
    promo_reservations: Array.isArray(o.promo_reservations)
      ? (o.promo_reservations as Record<string, unknown>[]).map((r) => ({
          id: String(r.id),
          status: String(r.status),
          public_ref: r.public_ref != null ? String(r.public_ref) : null,
          pickup_date: String(r.pickup_date),
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
          offer_title: r.offer_title != null ? String(r.offer_title) : null,
        }))
      : [],
  };
}

export function patientRequestDetailPath(requestType: string, requestId: string): string {
  return `${getRequestKindConfig(requestType).routes.patientHubPath}/${requestId}`;
}

export function patientPromoDetailPath(reservationId: string): string {
  return `/dashboard/patient/packs-promo/${reservationId}`;
}

export function pharmacyKindLabelsFr(kinds: string[]): string {
  const labels = kinds.map((k) =>
    getRequestKindConfig(k).theme.headerLabelShort.replace(/\.$/, "")
  );
  return [...new Set(labels)].join(" · ") || "—";
}

export function promoStatusLabelFr(status: string): string {
  if (
    status === "submitted" ||
    status === "confirmed" ||
    status === "cancelled" ||
    status === "collected" ||
    status === "unavailable"
  ) {
    return promoReservationLabel(status as PromoReservationStatus, "patient");
  }
  return status;
}

export function pharmacyWhatsAppHref(whatsapp: string | null | undefined): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function formatActivityFr(iso: string | null | undefined): string {
  return formatActivityForLocale(iso, "fr");
}

export function formatActivityForLocale(
  iso: string | null | undefined,
  locale: AppLocale,
): string {
  if (!iso) return "—";
  return formatDateTimeShortForLocale(iso, locale);
}

export function pharmacyDisplayName(
  nom: string | null | undefined,
  options?: { locale?: AppLocale; nomAr?: string | null },
): string {
  return pharmacyPublicLabel(nom, options);
}

export function pharmacyRatingLabelFr(
  ratingAvg: number | null | undefined,
  ratingCount: number | null | undefined,
): string | null {
  return pharmacyRatingLabelForLocale(ratingAvg, ratingCount, (avg, count) => `${avg} · ${count} avis`);
}

export function pharmacyRatingLabelForLocale(
  ratingAvg: number | null | undefined,
  ratingCount: number | null | undefined,
  format: (avg: string, count: number) => string,
): string | null {
  if (ratingAvg == null || !ratingCount || ratingCount < 1) return null;
  return format(ratingAvg.toFixed(1), ratingCount);
}
