import { formatChartDayFr } from "@/lib/pharmacist-dashboard";

export type ProfileAnalyticsPeriodPreset = "7d" | "30d" | "90d";

export function profileAnalyticsPeriodRange(preset: ProfileAnalyticsPeriodPreset, until = new Date()) {
  const since = new Date(until);
  if (preset === "7d") since.setDate(since.getDate() - 7);
  else if (preset === "30d") since.setDate(since.getDate() - 30);
  else since.setDate(since.getDate() - 90);
  return { preset, since, until };
}

export function profileAnalyticsPeriodLabel(preset: ProfileAnalyticsPeriodPreset): string {
  if (preset === "7d") return "7 derniers jours";
  if (preset === "30d") return "30 derniers jours";
  return "90 derniers jours";
}

export type ProfileAnalyticsPatientRow = {
  patient_id: string;
  full_name: string | null;
  patient_ref: string | null;
  profile_views: number;
  phone_clicks: number;
  whatsapp_clicks: number;
  requests_in_period: number;
  promo_in_period: number;
  last_touch_at: string | null;
};

export type ProfileAnalyticsJournalRow = {
  row_id: string;
  created_at: string;
  row_kind: "engagement" | "request" | "promo";
  detail_type: string;
  detail_source: string | null;
  patient_id: string | null;
  full_name: string | null;
  patient_ref: string | null;
  public_ref: string | null;
};

export type ProfileAnalyticsPayload = {
  period: { since: string; until: string };
  summary: {
    profile_views: number;
    phone_clicks: number;
    whatsapp_clicks: number;
    identified_events: number;
    anonymous_events: number;
    by_source: Record<string, number>;
    daily: {
      day: string;
      profile_views: number;
      phone_clicks: number;
      whatsapp_clicks: number;
      contact_clicks: number;
      identified: number;
      anonymous: number;
    }[];
    requests_created: number;
    promo_reservations_created: number;
  };
  patients: ProfileAnalyticsPatientRow[];
  events: ProfileAnalyticsJournalRow[];
  events_total: number;
};

const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

export function parseProfileAnalyticsPayload(raw: unknown): ProfileAnalyticsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary = (o.summary ?? {}) as Record<string, unknown>;
  const period = (o.period ?? {}) as Record<string, unknown>;
  const daily = Array.isArray(summary.daily) ? summary.daily : [];

  return {
    period: { since: String(period.since ?? ""), until: String(period.until ?? "") },
    summary: {
      profile_views: num(summary.profile_views),
      phone_clicks: num(summary.phone_clicks),
      whatsapp_clicks: num(summary.whatsapp_clicks),
      identified_events: num(summary.identified_events),
      anonymous_events: num(summary.anonymous_events),
      by_source: (summary.by_source as Record<string, number>) ?? {},
      daily: daily.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          day: String(r.day ?? ""),
          profile_views: num(r.profile_views),
          phone_clicks: num(r.phone_clicks),
          whatsapp_clicks: num(r.whatsapp_clicks),
          contact_clicks: num(r.contact_clicks),
          identified: num(r.identified),
          anonymous: num(r.anonymous),
        };
      }),
      requests_created: num(summary.requests_created),
      promo_reservations_created: num(summary.promo_reservations_created),
    },
    patients: Array.isArray(o.patients)
      ? (o.patients as Record<string, unknown>[]).map((p) => ({
          patient_id: String(p.patient_id),
          full_name: p.full_name != null ? String(p.full_name) : null,
          patient_ref: p.patient_ref != null ? String(p.patient_ref) : null,
          profile_views: num(p.profile_views),
          phone_clicks: num(p.phone_clicks),
          whatsapp_clicks: num(p.whatsapp_clicks),
          requests_in_period: num(p.requests_in_period),
          promo_in_period: num(p.promo_in_period),
          last_touch_at: p.last_touch_at != null ? String(p.last_touch_at) : null,
        }))
      : [],
    events: Array.isArray(o.events)
      ? (o.events as Record<string, unknown>[]).map((e) => ({
          row_id: String(e.row_id),
          created_at: String(e.created_at),
          row_kind: e.row_kind as ProfileAnalyticsJournalRow["row_kind"],
          detail_type: String(e.detail_type ?? ""),
          detail_source: e.detail_source != null ? String(e.detail_source) : null,
          patient_id: e.patient_id != null ? String(e.patient_id) : null,
          full_name: e.full_name != null ? String(e.full_name) : null,
          patient_ref: e.patient_ref != null ? String(e.patient_ref) : null,
          public_ref: e.public_ref != null ? String(e.public_ref) : null,
        }))
      : [],
    events_total: num(o.events_total),
  };
}

export { formatChartDayFr };

export const ENGAGEMENT_EVENT_LABEL: Record<string, string> = {
  profile_view: "Vue de la fiche",
  phone_click: "Clic appeler",
  whatsapp_click: "Clic WhatsApp",
};

export const ENGAGEMENT_SOURCE_LABEL: Record<string, string> = {
  annuaire: "Annuaire",
  profile: "Fiche publique",
};

export function journalRowLabel(row: ProfileAnalyticsJournalRow): string {
  if (row.row_kind === "engagement") {
    return ENGAGEMENT_EVENT_LABEL[row.detail_type] ?? row.detail_type;
  }
  if (row.row_kind === "request") {
    const types: Record<string, string> = {
      product_request: "Demande de produits",
      prescription: "Ordonnance",
      free_consultation: "Consultation libre",
    };
    return types[row.detail_type] ?? "Demande";
  }
  if (row.row_kind === "promo") return "Réservation pack promo";
  return row.detail_type;
}

export function journalRowMeta(row: ProfileAnalyticsJournalRow): string {
  const parts: string[] = [];
  if (row.row_kind === "engagement" && row.detail_source) {
    parts.push(ENGAGEMENT_SOURCE_LABEL[row.detail_source] ?? row.detail_source);
  }
  if (row.row_kind === "request" && row.detail_source) {
    parts.push(`Statut : ${row.detail_source}`);
  }
  if (row.row_kind === "promo" && row.detail_source) {
    parts.push(`Statut : ${row.detail_source}`);
  }
  if (row.public_ref?.trim()) parts.push(row.public_ref.trim());
  return parts.join(" · ");
}
