import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/lib/i18n/config";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";
import { requestDetailHrefWithConversationFocus } from "@/lib/request-detail-conversation-focus";

export type ConversationInboxRow = {
  requestId: string;
  requestPublicRef: string | null;
  requestType: string;
  counterpartLabel: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  hasUnread: boolean;
  href: string;
};

export type ConversationInboxLoadResult = {
  threads: ConversationInboxRow[];
  unreadCount: number;
};

type InboxRpcRow = {
  request_id: string;
  request_public_ref: string | null;
  request_type: string;
  counterpart_label: string;
  pharmacy_nom: string | null;
  pharmacy_nom_ar: string | null;
  patient_full_name: string | null;
  patient_ref: string | null;
  last_message_at: string;
  last_message_preview: string;
  has_unread: boolean;
};

function requestDetailHref(role: string, requestId: string): string {
  const base =
    role === "admin"
      ? `/admin/demandes/${requestId}`
      : role === "pharmacien"
        ? `/dashboard/pharmacien/demandes/${requestId}`
        : `/dashboard/demandes/${requestId}`;
  return requestDetailHrefWithConversationFocus(base);
}

export function buildConversationCounterpartLabel(
  role: string,
  locale: AppLocale,
  row: Pick<
    InboxRpcRow,
    "counterpart_label" | "pharmacy_nom" | "pharmacy_nom_ar" | "patient_full_name" | "patient_ref"
  >,
): string {
  if (role === "pharmacien") {
    const name = row.patient_full_name?.trim();
    const ref = row.patient_ref?.trim();
    if (name && ref) return `${name} · ${ref}`;
    if (name) return name;
    if (ref) return ref;
    return row.counterpart_label?.trim() || "Patient";
  }
  if (role === "patient") {
    return pharmacyPublicLabel(row.pharmacy_nom, { locale, nomAr: row.pharmacy_nom_ar });
  }
  return row.counterpart_label?.trim() || "Pharmacie";
}

export async function countUnreadConversationThreads(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("request_conversation_unread_count");
  if (error) return 0;
  const n = typeof data === "number" ? data : Number(data);
  return Number.isFinite(n) ? n : 0;
}

export async function loadConversationInbox(
  supabase: SupabaseClient,
  opts: {
    role: string;
    locale: AppLocale;
    limit?: number;
  },
): Promise<ConversationInboxLoadResult> {
  const { role, locale, limit = 30 } = opts;

  const [{ data: rows, error: inboxErr }, unreadCount] = await Promise.all([
    supabase.rpc("request_conversation_inbox", { p_limit: limit }),
    countUnreadConversationThreads(supabase),
  ]);

  if (inboxErr || !Array.isArray(rows)) {
    return { threads: [], unreadCount: inboxErr ? 0 : unreadCount };
  }

  const threads: ConversationInboxRow[] = (rows as InboxRpcRow[]).map((row) => ({
    requestId: row.request_id,
    requestPublicRef: row.request_public_ref,
    requestType: row.request_type,
    counterpartLabel: buildConversationCounterpartLabel(role, locale, row),
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
    hasUnread: row.has_unread === true,
    href: requestDetailHref(role, row.request_id),
  }));

  return { threads, unreadCount };
}

export async function countUnreadAlertNotifications(
  supabase: SupabaseClient,
  userId: string,
): Promise<number> {
  const [{ count: reqUnread }, { count: promoUnread }] = await Promise.all([
    supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null)
      .not("event_type", "like", "request_conversation:%"),
    supabase
      .from("promo_in_app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);
  return (reqUnread ?? 0) + (promoUnread ?? 0);
}

export async function markSingleAlertNotificationRead(
  supabase: SupabaseClient,
  row: { id: string; source: "request" | "promo" },
): Promise<void> {
  const nowIso = new Date().toISOString();
  if (row.source === "promo") {
    const rawId = row.id.startsWith("promo-") ? row.id.slice("promo-".length) : row.id;
    await supabase.from("promo_in_app_notifications").update({ read_at: nowIso }).eq("id", rawId);
    return;
  }
  await supabase.from("app_notifications").update({ read_at: nowIso }).eq("id", row.id);
}

export async function markAlertNotificationsAsRead(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const nowIso = new Date().toISOString();
  await Promise.all([
    supabase
      .from("app_notifications")
      .update({ read_at: nowIso })
      .eq("recipient_id", userId)
      .is("read_at", null)
      .not("event_type", "like", "request_conversation:%"),
    supabase
      .from("promo_in_app_notifications")
      .update({ read_at: nowIso })
      .eq("recipient_id", userId)
      .is("read_at", null),
  ]);
}
