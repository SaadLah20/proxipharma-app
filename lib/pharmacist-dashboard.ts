import { PHARMACIST_DASHBOARD_BUCKETS } from "@/lib/demandes-hub-buckets";
import { getRequestKindConfig } from "@/lib/request-kinds/registry";
import type { RequestKindId } from "@/lib/request-kinds/types";

export type DashboardPeriodPreset = "7d" | "30d" | "90d";

export type DashboardPeriodRange = {
  preset: DashboardPeriodPreset;
  since: Date;
  until: Date;
};

export function dashboardPeriodRange(preset: DashboardPeriodPreset, until = new Date()): DashboardPeriodRange {
  const since = new Date(until);
  if (preset === "7d") since.setDate(since.getDate() - 7);
  else if (preset === "30d") since.setDate(since.getDate() - 30);
  else since.setDate(since.getDate() - 90);
  return { preset, since, until };
}

export function dashboardPeriodLabel(preset: DashboardPeriodPreset): string {
  if (preset === "7d") return "7 derniers jours";
  if (preset === "30d") return "30 derniers jours";
  return "90 derniers jours";
}

export type DashboardDailyEngagement = {
  day: string;
  profile_views: number;
  phone_clicks: number;
  whatsapp_clicks: number;
  contact_clicks: number;
};

export type DashboardDailyRequests = {
  day: string;
  total: number;
  product_request: number;
  prescription: number;
  free_consultation: number;
};

export type PharmacistDashboardSnapshot = {
  period: { since: string; until: string };
  engagement: {
    profile_views: number;
    phone_clicks: number;
    whatsapp_clicks: number;
    daily: DashboardDailyEngagement[];
  };
  requests: {
    active_total: number;
    needs_action: number;
    awaiting_pickup: number;
    new_in_period: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    daily: DashboardDailyRequests[];
  };
  promo_reservations: {
    pending: number;
    confirmed_in_period: number;
    new_in_period: number;
  };
  clients: {
    distinct_total: number;
    new_in_period: number;
  };
};

export function parsePharmacistDashboardSnapshot(raw: unknown): PharmacistDashboardSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const engagement = (o.engagement ?? {}) as Record<string, unknown>;
  const requests = (o.requests ?? {}) as Record<string, unknown>;
  const promo = (o.promo_reservations ?? {}) as Record<string, unknown>;
  const clients = (o.clients ?? {}) as Record<string, unknown>;
  const period = (o.period ?? {}) as Record<string, unknown>;

  const dailyEng = Array.isArray(engagement.daily) ? engagement.daily : [];
  const dailyReq = Array.isArray(requests.daily) ? requests.daily : [];

  return {
    period: {
      since: String(period.since ?? ""),
      until: String(period.until ?? ""),
    },
    engagement: {
      profile_views: num(engagement.profile_views),
      phone_clicks: num(engagement.phone_clicks),
      whatsapp_clicks: num(engagement.whatsapp_clicks),
      daily: dailyEng.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          day: String(r.day ?? ""),
          profile_views: num(r.profile_views),
          phone_clicks: num(r.phone_clicks),
          whatsapp_clicks: num(r.whatsapp_clicks),
          contact_clicks: num(r.contact_clicks),
        };
      }),
    },
    requests: {
      active_total: num(requests.active_total),
      needs_action: num(requests.needs_action),
      awaiting_pickup: num(requests.awaiting_pickup),
      new_in_period: num(requests.new_in_period),
      by_type: (requests.by_type as Record<string, number>) ?? {},
      by_status: (requests.by_status as Record<string, number>) ?? {},
      daily: dailyReq.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          day: String(r.day ?? ""),
          total: num(r.total),
          product_request: num(r.product_request),
          prescription: num(r.prescription),
          free_consultation: num(r.free_consultation),
        };
      }),
    },
    promo_reservations: {
      pending: num(promo.pending),
      confirmed_in_period: num(promo.confirmed_in_period),
      new_in_period: num(promo.new_in_period),
    },
    clients: {
      distinct_total: num(clients.distinct_total),
      new_in_period: num(clients.new_in_period),
    },
  };
}

export function countRequestsInPharmacistBucket(
  byStatus: Record<string, number>,
  bucketKey: (typeof PHARMACIST_DASHBOARD_BUCKETS)[number]["key"]
): number {
  const bucket = PHARMACIST_DASHBOARD_BUCKETS.find((b) => b.key === bucketKey);
  if (!bucket) return 0;
  return bucket.statuses.reduce((sum, st) => sum + (byStatus[st] ?? 0), 0);
}

export function requestTypeLabelFr(type: string): string {
  return getRequestKindConfig(type).theme.headerLabelShort.replace(/\.$/, "") || type;
}

export function requestTypeHubPath(type: string): string {
  const cfg = getRequestKindConfig(type);
  return cfg.routes.pharmacistHubPath;
}

export function isRequestKindIdSafe(v: string): v is RequestKindId {
  return v === "product_request" || v === "prescription" || v === "free_consultation";
}

export function formatChartDayFr(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dt.toLocaleDateString("fr-FR", {
    timeZone: "Africa/Casablanca",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export { PHARMACIST_DASHBOARD_BUCKETS };
