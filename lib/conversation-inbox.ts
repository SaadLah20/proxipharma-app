import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppLocale } from "@/lib/i18n/config";
import { one } from "@/lib/embed";
import { conversationMessagePreviewFr } from "@/lib/request-conversation";
import { pharmacyPublicLabel } from "@/lib/pharmacy-public-label";

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

type RequestLite = {
  id: string;
  request_public_ref: string | null;
  request_type: string;
  patient_id: string;
  pharmacies: { nom: string | null; nom_ar: string | null } | { nom: string | null; nom_ar: string | null }[] | null;
};

type CommentLite = {
  request_id: string;
  created_at: string;
  comment_text: string | null;
  audio_path: string | null;
  audio_duration_seconds: number | null;
  deleted_at: string | null;
};

function requestDetailHref(role: string, requestId: string): string {
  if (role === "admin") return `/admin/demandes/${requestId}`;
  if (role === "pharmacien") return `/dashboard/pharmacien/demandes/${requestId}`;
  return `/dashboard/demandes/${requestId}`;
}

async function fetchAccessibleRequests(
  supabase: SupabaseClient,
  userId: string,
  role: string,
): Promise<RequestLite[]> {
  if (role === "pharmacien") {
    const { data: staff } = await supabase
      .from("pharmacy_staff")
      .select("pharmacy_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (!staff?.pharmacy_id) return [];
    const { data } = await supabase
      .from("requests")
      .select("id,request_public_ref,request_type,patient_id,pharmacies(nom,nom_ar)")
      .eq("pharmacy_id", staff.pharmacy_id)
      .order("updated_at", { ascending: false })
      .limit(200);
    return (data ?? []) as RequestLite[];
  }

  let q = supabase
    .from("requests")
    .select("id,request_public_ref,request_type,patient_id,pharmacies(nom,nom_ar)")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (role === "patient") {
    q = q.eq("patient_id", userId);
  }

  const { data } = await q;
  return (data ?? []) as RequestLite[];
}

async function pharmacistPatientLabels(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const { data } = await supabase.rpc("pharmacist_patient_directory_for_my_pharmacy");
  const map = new Map<string, string>();
  if (!Array.isArray(data)) return map;
  for (const row of data as { patient_id: string; full_name: string | null; patient_ref: string | null }[]) {
    const name = row.full_name?.trim();
    const ref = row.patient_ref?.trim();
    if (name && ref) map.set(row.patient_id, `${name} · ${ref}`);
    else if (name) map.set(row.patient_id, name);
    else if (ref) map.set(row.patient_id, ref);
  }
  return map;
}

function counterpartLabelForRequest(
  role: string,
  req: RequestLite,
  locale: AppLocale,
  patientLabels: Map<string, string>,
): string {
  if (role === "pharmacien") {
    return patientLabels.get(req.patient_id) ?? "Patient";
  }
  const ph = one(req.pharmacies);
  if (ph?.nom) return pharmacyPublicLabel(ph.nom, { locale, nomAr: ph.nom_ar });
  return "Pharmacie";
}

export async function loadConversationInbox(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    role: string;
    locale: AppLocale;
    limit?: number;
  },
): Promise<ConversationInboxLoadResult> {
  const { userId, role, locale, limit = 30 } = opts;
  const requests = await fetchAccessibleRequests(supabase, userId, role);
  if (requests.length === 0) return { threads: [], unreadCount: 0 };

  const requestIds = requests.map((r) => r.id);
  const requestById = new Map(requests.map((r) => [r.id, r]));

  const [{ data: comments }, { data: unreadFlags }] = await Promise.all([
    supabase
      .from("request_comments")
      .select("request_id,created_at,comment_text,audio_path,audio_duration_seconds,deleted_at")
      .in("request_id", requestIds)
      .eq("is_internal", false)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.rpc("request_conversation_unread_flags", { p_request_ids: requestIds }),
  ]);

  const unreadByRequestId = new Map<string, boolean>();
  if (Array.isArray(unreadFlags)) {
    for (const row of unreadFlags as { request_id: string; has_unread: boolean }[]) {
      if (row.request_id) unreadByRequestId.set(row.request_id, row.has_unread === true);
    }
  }

  const unreadCount = [...unreadByRequestId.values()].filter(Boolean).length;

  const latestCommentByRequest = new Map<string, CommentLite>();
  for (const raw of (comments ?? []) as CommentLite[]) {
    if (!raw.request_id || latestCommentByRequest.has(raw.request_id)) continue;
    latestCommentByRequest.set(raw.request_id, raw);
  }

  if (latestCommentByRequest.size === 0) {
    return { threads: [], unreadCount };
  }

  const patientLabels = role === "pharmacien" ? await pharmacistPatientLabels(supabase) : new Map<string, string>();

  const threads: ConversationInboxRow[] = [...latestCommentByRequest.entries()]
    .map(([requestId, comment]) => {
      const req = requestById.get(requestId);
      if (!req) return null;
      return {
        requestId,
        requestPublicRef: req.request_public_ref,
        requestType: req.request_type,
        counterpartLabel: counterpartLabelForRequest(role, req, locale, patientLabels),
        lastMessageAt: comment.created_at,
        lastMessagePreview: conversationMessagePreviewFr(comment),
        hasUnread: unreadByRequestId.get(requestId) === true,
        href: requestDetailHref(role, requestId),
      };
    })
    .filter((row): row is ConversationInboxRow => row !== null)
    .sort((a, b) => {
      if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
      return b.lastMessageAt.localeCompare(a.lastMessageAt);
    })
    .slice(0, limit);

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
