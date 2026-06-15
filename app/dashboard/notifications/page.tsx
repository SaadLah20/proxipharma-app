"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { accountBackForRole } from "@/lib/platform-dashboard-chrome";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
import { ConversationInboxItem } from "@/components/notifications/conversation-inbox-item";
import { InboxChannelTabs, type InboxChannelTab } from "@/components/notifications/inbox-channel-tabs";
import type { AppLocale } from "@/lib/i18n/config";
import { isAlertNotificationEvent } from "@/lib/in-app-notification-channels";
import {
  countUnreadAlertNotifications,
  loadConversationInbox,
  markAlertNotificationsAsRead,
  type ConversationInboxRow,
} from "@/lib/conversation-inbox";
import { pickPatientNotificationText } from "@/lib/i18n/pick-notification-text";
import { rewriteForPharmacistView } from "@/lib/patient-copy";
import { supabase } from "@/lib/supabase";

type RequestTypeFilter = "product_request" | "prescription" | "free_consultation";

type NotificationFilter = "all" | RequestTypeFilter | "promo";

type FeedRow = {
  id: string;
  created_at: string;
  title: string;
  body: string | null;
  title_ar: string | null;
  body_ar: string | null;
  read_at: string | null;
  event_type: string | null;
  href: string;
  source: "request" | "promo";
  requestType: RequestTypeFilter | null;
};

function parseRequestTypeFilter(value: string | null | undefined): RequestTypeFilter | null {
  if (value === "product_request" || value === "prescription" || value === "free_consultation") {
    return value;
  }
  return null;
}

function channelFromSearch(value: string | null): InboxChannelTab {
  return value === "messages" ? "messages" : "notifications";
}

function requestHref(role: string, requestId: string) {
  if (role === "admin") return `/admin/demandes/${requestId}`;
  if (role === "pharmacien") return `/dashboard/pharmacien/demandes/${requestId}`;
  return `/dashboard/demandes/${requestId}`;
}

function promoHref(role: string, reservationId: string) {
  if (role === "pharmacien") return `/dashboard/pharmacien/reservations-packs/${reservationId}`;
  return `/dashboard/patient/packs-promo/${reservationId}`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale() as AppLocale;
  const tn = useTranslations("notifications");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("patient");
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [messageThreads, setMessageThreads] = useState<ConversationInboxRow[]>([]);
  const [alertUnreadCount, setAlertUnreadCount] = useState(0);
  const [messageUnreadCount, setMessageUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [error, setError] = useState("");

  const channelTab = channelFromSearch(searchParams.get("onglet"));

  const setChannelTab = useCallback(
    (tab: InboxChannelTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === "messages") next.set("onglet", "messages");
      else next.delete("onglet");
      router.replace(`/dashboard/notifications?${next.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const markAlertRowsAsRead = useCallback(async (uid: string) => {
    const nowIso = new Date().toISOString();
    setRows((prev) => prev.map((r) => (!r.read_at ? { ...r, read_at: nowIso } : r)));
    setAlertUnreadCount(0);
    await markAlertNotificationsAsRead(supabase, uid);
  }, []);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/notifications");
      return;
    }
    setUserId(user.id);

    const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }
    const r = (profile as { role?: string } | null)?.role ?? "patient";
    setRole(r);

    const [{ data: reqNotifs, error: re }, { data: promoNotifs, error: pe2 }, inbox, alertUnread] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id,created_at,title,body,title_ar,body_ar,request_id,read_at,event_type,requests(request_type)")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("promo_in_app_notifications")
        .select("id,created_at,title,body,reservation_id,read_at,event_type")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
      loadConversationInbox(supabase, { role: r, limit: 40 }),
      countUnreadAlertNotifications(supabase, user.id),
    ]);

    if (re || pe2) {
      setError(re?.message ?? pe2?.message ?? "Erreur");
      setLoading(false);
      return;
    }

    const alertRows: FeedRow[] = [
      ...(reqNotifs ?? [])
        .filter((n) => isAlertNotificationEvent((n as { event_type: string | null }).event_type))
        .map((n) => {
          const row = n as {
            id: string;
            created_at: string;
            title: string;
            body: string | null;
            title_ar?: string | null;
            body_ar?: string | null;
            request_id: string;
            read_at: string | null;
            event_type: string | null;
            requests: { request_type: string } | { request_type: string }[] | null;
          };
          const reqJoin = row.requests;
          const requestTypeRaw = Array.isArray(reqJoin) ? reqJoin[0]?.request_type : reqJoin?.request_type;
          return {
            id: row.id,
            created_at: row.created_at,
            title: row.title,
            body: row.body,
            title_ar: row.title_ar ?? null,
            body_ar: row.body_ar ?? null,
            read_at: row.read_at,
            event_type: row.event_type,
            href: requestHref(r, row.request_id),
            source: "request" as const,
            requestType: parseRequestTypeFilter(requestTypeRaw),
          };
        }),
      ...(promoNotifs ?? []).map((n) => {
        const row = n as {
          id: string;
          created_at: string;
          title: string;
          body: string | null;
          reservation_id: string;
          read_at: string | null;
          event_type: string | null;
        };
        return {
          id: `promo-${row.id}`,
          created_at: row.created_at,
          title: row.title,
          body: row.body,
          title_ar: null,
          body_ar: null,
          read_at: row.read_at,
          event_type: row.event_type,
          href: promoHref(r, row.reservation_id),
          source: "promo" as const,
          requestType: null,
        };
      }),
    ].sort((a, b) => b.created_at.localeCompare(a.created_at));

    setRows(alertRows);
    setMessageThreads(inbox.threads);
    setMessageUnreadCount(inbox.unreadCount);
    setAlertUnreadCount(alertUnread);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  useEffect(() => {
    if (loading || channelTab !== "notifications" || !userId) return;
    void markAlertRowsAsRead(userId);
  }, [channelTab, loading, markAlertRowsAsRead, userId]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "promo") return rows.filter((x) => x.source === "promo");
    return rows.filter((x) => x.source === "request" && x.requestType === filter);
  }, [rows, filter]);

  const filterTabs = useMemo(
    () =>
      [
        { key: "all" as const, label: tn("filterAll") },
        { key: "product_request" as const, label: tn("filterProductRequests") },
        { key: "prescription" as const, label: tn("filterPrescriptions") },
        { key: "free_consultation" as const, label: tn("filterConsultations") },
        { key: "promo" as const, label: tn("filterPromo") },
      ] as const,
    [tn],
  );

  const audience = role === "pharmacien" ? "pharmacien" : role === "admin" ? "admin" : "patient";

  const displayRows = useMemo(
    () =>
      filtered.map((n) => {
        const picked = pickPatientNotificationText(
          {
            title: n.title,
            body: n.body,
            title_ar: n.title_ar,
            body_ar: n.body_ar,
          },
          locale,
          audience,
        );
        const displayTitle =
          audience === "pharmacien" ? (rewriteForPharmacistView(picked.title) ?? picked.title) : picked.title;
        const displayBody =
          audience === "pharmacien" ? rewriteForPharmacistView(picked.body) : picked.body;
        return { ...n, displayTitle, displayBody };
      }),
    [filtered, locale, audience],
  );

  const handleChannelChange = useCallback(
    (tab: InboxChannelTab) => {
      setChannelTab(tab);
    },
    [setChannelTab],
  );

  const refreshAfterMessageOpen = useCallback(() => {
    if (!userId) return;
    void load();
  }, [load, userId]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      </PageShell>
    );
  }

  const back = accountBackForRole(role);
  const subtitle =
    role === "pharmacien"
      ? "Alertes dossiers, packs promo et messages patients."
      : role === "admin"
        ? "Alertes dossiers et messages du pilote Pharmeto."
        : tn("patientSubtitle");

  return (
    <PageShell className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden">
      {role === "pharmacien" ? (
        <PharmacistAccountPageHeader
          eyebrow="Espace pharmacien"
          title="Notifications"
          subtitle={subtitle}
          backHref={back.href}
          backLabel={back.label}
        />
      ) : role === "admin" ? (
        <AdminAccountPageHeader
          title="Notifications"
          subtitle={subtitle}
          backHref={back.href}
          backLabel={back.label}
        />
      ) : (
        <PatientAccountPageHeader
          eyebrow={tn("patientEyebrow")}
          title={tn("pageTitle")}
          subtitle={subtitle}
          backHref={back.href}
          backLabel={back.label}
        />
      )}

      <InboxChannelTabs
        active={channelTab}
        onChange={handleChannelChange}
        alertCount={alertUnreadCount}
        messageCount={messageUnreadCount}
        notificationsLabel={tn("tabNotifications")}
        messagesLabel={tn("tabMessages")}
      />

      {channelTab === "notifications" ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={clsx(
                  "rounded-full px-3 py-1 text-[11px] font-bold",
                  filter === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

          {filtered.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {tn("emptyFeed")}
            </p>
          ) : (
            <ul className="w-full min-w-0 max-w-full space-y-3">
              {displayRows.map((n) => (
                <li key={n.id} className="min-w-0 max-w-full">
                  <InAppNotificationItem
                    title={n.displayTitle}
                    body={n.displayBody}
                    createdAt={n.created_at}
                    eventType={n.event_type}
                    href={n.href}
                    isRead={Boolean(n.read_at)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
          {messageThreads.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {tn("emptyMessagesFeed")}
            </p>
          ) : (
            <ul className="w-full min-w-0 max-w-full space-y-3">
              {messageThreads.map((thread) => (
                <li key={thread.requestId} className="min-w-0 max-w-full">
                  <ConversationInboxItem row={thread} onNavigate={refreshAfterMessageOpen} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageShell>
  );
}
