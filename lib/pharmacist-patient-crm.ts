import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import { promoReservationLabel } from "@/lib/promo/reservation-status-ui";
import type { PromoReservationStatus } from "@/lib/promo/types";

export type PharmacistPatientDirectoryRow = {
  patient_id: string;
  full_name: string | null;
  whatsapp: string | null;
  email: string | null;
  patient_ref: string | null;
  request_count: number;
  active_request_count: number;
  promo_reservation_count: number;
  last_activity_at: string | null;
  last_request_status: string | null;
  request_kinds: string[];
};

export type PharmacistPatientDetailRequest = {
  id: string;
  request_type: string;
  status: string;
  request_public_ref: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  responded_at: string | null;
};

export type PharmacistPatientDetailPromo = {
  id: string;
  status: string;
  public_ref: string | null;
  pickup_date: string;
  created_at: string;
  updated_at: string;
  offer_title: string | null;
};

export type PharmacistPatientDetail = {
  contact: {
    patient_id: string;
    full_name: string | null;
    whatsapp: string | null;
    email: string | null;
    patient_ref: string | null;
  };
  requests: PharmacistPatientDetailRequest[];
  promo_reservations: PharmacistPatientDetailPromo[];
};

export function parsePharmacistPatientDetail(raw: unknown): PharmacistPatientDetail | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const contact = o.contact as Record<string, unknown> | undefined;
  if (!contact?.patient_id) return null;
  return {
    contact: {
      patient_id: String(contact.patient_id),
      full_name: contact.full_name != null ? String(contact.full_name) : null,
      whatsapp: contact.whatsapp != null ? String(contact.whatsapp) : null,
      email: contact.email != null ? String(contact.email) : null,
      patient_ref: contact.patient_ref != null ? String(contact.patient_ref) : null,
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
  return `${getRequestKindConfig(requestType).routes.pharmacistHubPath}/${requestId}`;
}

export function patientPromoDetailPath(reservationId: string): string {
  return `/dashboard/pharmacien/reservations-packs/${reservationId}`;
}

export function requestKindLabelsFr(kinds: string[]): string {
  const labels = kinds.map((k) => getRequestKindConfig(k).theme.headerLabelShort.replace(/\.$/, ""));
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
    return promoReservationLabel(status as PromoReservationStatus, "pharmacien");
  }
  return status;
}

export function whatsappHref(whatsapp: string | null | undefined): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function formatActivityFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: "Africa/Casablanca",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
