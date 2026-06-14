"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { accountBackForRole } from "@/lib/platform-dashboard-chrome";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
import type { AppLocale } from "@/lib/i18n/config";
import { pickPatientNotificationText } from "@/lib/i18n/pick-notification-text";
import { rewriteForPharmacistView } from "@/lib/patient-copy";
import { supabase } from "@/lib/supabase";

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
};

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
  const locale = useLocale() as AppLocale;
  const tn = useTranslations("notifications");
  const tc = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("patient");
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [filter, setFilter] = useState<"all" | "request" | "promo">("all");
  const [error, setError] = useState("");

  const markAllAsRead = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user?.id;
    if (!userId) return;
    const nowIso = new Date().toISOString();
    setRows((prev) => prev.map((r) => (!r.read_at ? { ...r, read_at: nowIso } : r)));
    await Promise.all([
      supabase.from("app_notifications").update({ read_at: nowIso }).eq("recipient_id", userId).is("read_at", null),
      supabase
        .from("promo_in_app_notifications")
        .update({ read_at: nowIso })
        .eq("recipient_id", userId)
        .is("read_at", null),
    ]);
  }, []);

  const load = useCallback(async () => {
    setError("");
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user;
    if (!user) {
      router.replace("/auth?redirect=/dashboard/notifications");
      return;
    }

    const { data: profile, error: pe } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (pe) {
      setError(pe.message);
      setLoading(false);
      return;
    }
    const r = (profile as { role?: string } | null)?.role ?? "patient";
    setRole(r);

    const [{ data: reqNotifs, error: re }, { data: promoNotifs, error: pe2 }] = await Promise.all([
      supabase
        .from("app_notifications")
        .select("id,created_at,title,body,title_ar,body_ar,request_id,read_at,event_type")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("promo_in_app_notifications")
        .select("id,created_at,title,body,reservation_id,read_at,event_type")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    if (re || pe2) {
      setError(re?.message ?? pe2?.message ?? "Erreur");
      setLoading(false);
      return;
    }

    const merged: FeedRow[] = [
      ...(reqNotifs ?? []).map((n) => {
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
        };
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
        };
      }),
    ]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 80);

    setRows(merged);
    void markAllAsRead();
    setLoading(false);
  }, [markAllAsRead, router]);

  useEffect(() => {
    const tid = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(tid);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((x) => x.source === filter);
  }, [rows, filter]);

  const promoCount = rows.filter((x) => x.source === "promo").length;

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
      ? "Alertes dossiers et réservations packs promo de votre officine."
      : role === "admin"
        ? "Alertes dossiers et événements du pilote Pharmeto."
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

      {promoCount > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "all", label: tn("filterAll") },
              { key: "request", label: tn("filterRequests") },
              { key: "promo", label: tn("filterPromo") },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={clsx(
                "rounded-full px-3 py-1 text-[11px] font-bold",
                filter === tab.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

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
    </PageShell>
  );
}
