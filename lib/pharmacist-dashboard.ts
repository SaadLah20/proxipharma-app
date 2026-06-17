import {
  PHARMACIST_DASHBOARD_BUCKETS,
  PHARMACIST_STAT_BUCKET_GROUPS,
  type DemandeStatBucketGroup,
} from "@/lib/demandes-hub-buckets";
import { hubPathForRequestKind } from "@/lib/request-hub-parcours";
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

export type PharmacistDashboardOnCallPeriod = {
  id: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

export type PharmacistDashboardDayOverride = {
  date: string;
  kind: string;
  label: string | null;
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
    responded_pending: number;
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
  operations: {
    ordered_pending: number;
    shortage_active: number;
    catalog_published: number;
    catalog_draft: number;
    catalog_reports_open: number;
    promo_offers_active: number;
    pricing_global_margin_pct: number;
    pricing_brand_rules_count: number;
  };
  schedule: {
    next_on_call: PharmacistDashboardOnCallPeriod | null;
    on_call_active_today: boolean;
    next_day_override: PharmacistDashboardDayOverride | null;
    weekly_hours_days_configured: number;
  };
  messages: {
    unread_conversations: number;
  };
  ratings: {
    average_score: number;
    total_count: number;
  };
};

function parseOnCallPeriod(raw: unknown): PharmacistDashboardOnCallPeriod | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    kind: String(o.kind ?? ""),
    starts_at: String(o.starts_at ?? ""),
    ends_at: String(o.ends_at ?? ""),
    note: o.note != null ? String(o.note) : null,
  };
}

function parseDayOverride(raw: unknown): PharmacistDashboardDayOverride | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const date = String(o.date ?? "").trim();
  if (!date) return null;
  return {
    date,
    kind: String(o.kind ?? ""),
    label: o.label != null ? String(o.label) : null,
  };
}

export function parsePharmacistDashboardSnapshot(raw: unknown): PharmacistDashboardSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  const engagement = (o.engagement ?? {}) as Record<string, unknown>;
  const requests = (o.requests ?? {}) as Record<string, unknown>;
  const promo = (o.promo_reservations ?? {}) as Record<string, unknown>;
  const clients = (o.clients ?? {}) as Record<string, unknown>;
  const operations = (o.operations ?? {}) as Record<string, unknown>;
  const schedule = (o.schedule ?? {}) as Record<string, unknown>;
  const messages = (o.messages ?? {}) as Record<string, unknown>;
  const ratings = (o.ratings ?? {}) as Record<string, unknown>;
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
      responded_pending: num(requests.responded_pending),
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
    operations: {
      ordered_pending: num(operations.ordered_pending),
      shortage_active: num(operations.shortage_active),
      catalog_published: num(operations.catalog_published),
      catalog_draft: num(operations.catalog_draft),
      catalog_reports_open: num(operations.catalog_reports_open),
      promo_offers_active: num(operations.promo_offers_active),
      pricing_global_margin_pct: num(operations.pricing_global_margin_pct),
      pricing_brand_rules_count: num(operations.pricing_brand_rules_count),
    },
    schedule: {
      next_on_call: parseOnCallPeriod(schedule.next_on_call),
      on_call_active_today: schedule.on_call_active_today === true,
      next_day_override: parseDayOverride(schedule.next_day_override),
      weekly_hours_days_configured: num(schedule.weekly_hours_days_configured),
    },
    messages: {
      unread_conversations: num(messages.unread_conversations),
    },
    ratings: {
      average_score: num(ratings.average_score),
      total_count: num(ratings.total_count),
    },
  };
}

export function countPharmacistWorkflowGroup(
  byStatus: Record<string, number>,
  group: DemandeStatBucketGroup
): number {
  let total = 0;
  for (const key of group.bucketKeys) {
    const bucket = PHARMACIST_DASHBOARD_BUCKETS.find((b) => b.key === key);
    if (!bucket) continue;
    for (const status of bucket.statuses) {
      total += byStatus[status] ?? 0;
    }
  }
  return total;
}

export function pharmacistWorkflowGroupCounts(byStatus: Record<string, number>) {
  return PHARMACIST_STAT_BUCKET_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    subtitle: group.subtitle,
    count: countPharmacistWorkflowGroup(byStatus, group),
  }));
}

const ON_CALL_KIND_LABELS: Record<string, string> = {
  weekend_48h: "Garde week-end (48 h)",
  weekday_24h: "Garde semaine (24 h)",
  holiday_24h: "Garde jour férié (24 h)",
};

export function onCallKindLabelFr(kind: string): string {
  return ON_CALL_KIND_LABELS[kind] ?? "Garde";
}

export function formatOnCallRangeFr(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "Africa/Casablanca",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  return `${start.toLocaleString("fr-FR", opts)} → ${end.toLocaleString("fr-FR", opts)}`;
}

export function dayOverrideLabelFr(override: PharmacistDashboardDayOverride): string {
  const [y, m, d] = override.date.split("-").map(Number);
  const dateLabel =
    y && m && d
      ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString("fr-FR", {
          timeZone: "Africa/Casablanca",
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      : override.date;
  const typeLabel =
    override.kind === "closed"
      ? "Fermeture"
      : override.kind === "holiday"
        ? "Férié"
        : "Horaire spécial";
  const custom = override.label?.trim();
  return custom ? `${typeLabel} · ${dateLabel} — ${custom}` : `${typeLabel} · ${dateLabel}`;
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
  if (cfg.id === "product_request" || cfg.id === "prescription" || cfg.id === "free_consultation") {
    return hubPathForRequestKind(cfg.id, "pharmacien");
  }
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
