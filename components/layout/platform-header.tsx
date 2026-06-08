"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bell,
  Building2,
  Calculator,
  CalendarClock,
  ChevronDown,
  FileText,
  Gift,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Store,
  User,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useLocale, useTranslations } from "next-intl";
import { PharmetoLogo } from "@/components/brand/pharmeto-logo";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
import { LocaleRoleGuard } from "@/components/layout/locale-role-guard";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { pickPatientNotificationText } from "@/lib/i18n/pick-notification-text";
import { rewriteForPharmacistView } from "@/lib/patient-copy";
import type { AppLocale } from "@/lib/i18n/config";
import { supabase } from "@/lib/supabase";

type ProfileLite = {
  id: string;
  full_name: string | null;
  role: "patient" | "pharmacien" | "admin";
};

type HeaderNotifRow = {
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

function promoNotifHref(role: string, reservationId: string) {
  if (role === "pharmacien") return `/dashboard/pharmacien/reservations-packs/${reservationId}`;
  return `/dashboard/patient/packs-promo/${reservationId}`;
}

function initials(name: string | null | undefined) {
  const t = (name ?? "").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return t.slice(0, 2).toUpperCase();
}

function notifDetailHref(role: string, requestId: string) {
  if (role === "admin") return `/admin/demandes/${requestId}`;
  if (role === "pharmacien") return `/dashboard/pharmacien/demandes/${requestId}`;
  return `/dashboard/demandes/${requestId}`;
}

/** Zone scrollable du menu compte avec dégradé + chevron si le contenu dépasse. */
function ProfileNavScrollPanel({
  children,
  maxHeightClass = "max-h-[min(70vh,24rem)]",
  scrollHint,
}: {
  children: ReactNode;
  maxHeightClass?: string;
  scrollHint: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const updateScrollHint = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
    setShowScrollHint(overflow && !atBottom);
  }, []);

  useEffect(() => {
    const run = () => updateScrollHint();
    run();
    const t = window.setTimeout(run, 0);
    const el = scrollRef.current;
    if (!el) return () => window.clearTimeout(t);
    const observer = new ResizeObserver(run);
    observer.observe(el);
    return () => {
      window.clearTimeout(t);
      observer.disconnect();
    };
  }, [updateScrollHint, children]);

  return (
    <div className="relative min-h-0">
      <div
        ref={scrollRef}
        className={`overflow-y-auto overscroll-y-contain ${maxHeightClass}`}
        onScroll={updateScrollHint}
      >
        {children}
      </div>
      {showScrollHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 bg-gradient-to-t from-popover from-45% via-popover/90 to-transparent pb-1.5 pt-8"
          aria-hidden
        >
          <ChevronDown className="size-4 animate-bounce text-primary/80" strokeWidth={2.5} />
          <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {scrollHint}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ProfileNavLogoutButton({ onLogout, label }: { onLogout: () => void; label: string }) {
  return (
    <div className="shrink-0 border-t border-border/80 bg-popover px-2 py-1.5">
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {label}
      </button>
    </div>
  );
}

function usePatientNavMenu(): PlatformNavBlock[] {
  const t = useTranslations("header.patient");
  const tn = useTranslations("header.notifications");
  return [
    { kind: "link", item: { href: "/dashboard/notifications", label: tn("title"), icon: Bell } },
    { kind: "link", item: { href: "/dashboard/patient/pharmacies", label: t("myPharmacies"), icon: MapPin } },
    { kind: "link", item: { href: "/", label: t("directory"), icon: Building2 } },
    { kind: "link", item: { href: "/dashboard/patient/parametres", label: t("settings"), icon: Settings } },
  ];
}

export type PlatformNavItem = { href: string; label: string; icon: LucideIcon };

/** Bloc menu : lien seul (pas de rubrique) ou section avec 2+ entrées. */
export type PlatformNavBlock =
  | { kind: "link"; item: PlatformNavItem; emphasis?: "primary" }
  | { kind: "section"; id: string; heading: string; items: PlatformNavItem[] };

function flattenNavBlocks(blocks: PlatformNavBlock[]): PlatformNavItem[] {
  return blocks.flatMap((b) => (b.kind === "section" ? b.items : [b.item]));
}

/** Patient : raccourcis compte (dossiers = barre basse). */
export const patientNavMenu: PlatformNavBlock[] = [
  { kind: "link", item: { href: "/dashboard/notifications", label: "Notifications", icon: Bell } },
  { kind: "link", item: { href: "/dashboard/patient/pharmacies", label: "Mes pharmacies", icon: MapPin } },
  { kind: "link", item: { href: "/", label: "Annuaire pharmacies", icon: Building2 } },
  { kind: "link", item: { href: "/dashboard/patient/parametres", label: "Mes paramètres", icon: Settings } },
];

/**
 * Pharmacien : accueil → supply → officine (dont promos) → outil → paramètres (dossiers = barre basse).
 */
export const pharmacienNavMenu: PlatformNavBlock[] = [
  {
    kind: "link",
    emphasis: "primary",
    item: { href: "/dashboard/pharmacien", label: "Tableau de bord", icon: LayoutDashboard },
  },
  {
    kind: "section",
    id: "supply",
    heading: "Suivi approvisionnement",
    items: [
      { href: "/dashboard/pharmacien/produits-commandes", label: "Produits commandés", icon: ShoppingBag },
      { href: "/dashboard/pharmacien/ruptures-marche", label: "Produits en rupture", icon: AlertTriangle },
    ],
  },
  {
    kind: "section",
    id: "officine",
    heading: "Officine & visibilité",
    items: [
      { href: "/dashboard/pharmacien/clients", label: "Clients", icon: Users },
      { href: "/dashboard/pharmacien/ma-fiche", label: "Ma fiche publique", icon: Store },
      { href: "/dashboard/pharmacien/horaires-garde", label: "Horaires et garde", icon: CalendarClock },
      { href: "/dashboard/pharmacien/offres-promos", label: "Offres et promos", icon: Gift },
      { href: "/dashboard/pharmacien/visites-interactions", label: "Visites et interactions", icon: MapPin },
    ],
  },
  {
    kind: "link",
    item: { href: "/dashboard/pharmacien/pricing", label: "Moteur de pricing", icon: Calculator },
  },
  { kind: "link", item: { href: "/dashboard/notifications", label: "Notifications", icon: Bell } },
  { kind: "link", item: { href: "/dashboard/pharmacien/parametres", label: "Mes paramètres", icon: Settings } },
];

export const patientNavLinks = flattenNavBlocks(patientNavMenu);
export const pharmacienNavLinks = flattenNavBlocks(pharmacienNavMenu);

function ProfileNavSectionHeading({ children }: { children: string }) {
  return (
    <div className="mx-2 mb-1 mt-3 rounded-md bg-muted/70 px-2.5 py-1.5 first:mt-0" role="presentation">
      <p className="pointer-events-none select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

function ProfileNavMenuLink({
  item,
  onNavigate,
  emphasis,
}: {
  item: PlatformNavItem;
  onNavigate: () => void;
  emphasis?: "primary";
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={
        emphasis === "primary"
          ? "mx-2 flex items-center gap-2.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-2.5 text-sm font-semibold text-foreground shadow-sm transition hover:bg-muted/70"
          : "mx-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
      }
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2} aria-hidden />
      <span className="min-w-0 leading-snug" dir="auto">
        {item.label}
      </span>
    </Link>
  );
}

function ProfileNavMenuDivider() {
  return <div className="mx-3 my-2 border-t border-border/80" role="separator" />;
}

function ProfileNavMenu({ blocks, onNavigate }: { blocks: PlatformNavBlock[]; onNavigate: () => void }) {
  return (
    <nav className="space-y-0.5 px-0 pb-1 pt-0.5" aria-label="Navigation du compte">
      {blocks.map((block, i) => {
        const prev = blocks[i - 1];
        const showDivider =
          i > 0 &&
          block.kind === "link" &&
          !block.emphasis &&
          (prev?.kind === "section" || prev?.kind === "link");

        if (block.kind === "section") {
          return (
            <div key={block.id}>
              <ProfileNavSectionHeading>{block.heading}</ProfileNavSectionHeading>
              <ul className="space-y-px">
                {block.items.map((item) => (
                  <li key={item.href}>
                    <ProfileNavMenuLink item={item} onNavigate={onNavigate} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        return (
          <div key={block.item.href}>
            {showDivider ? <ProfileNavMenuDivider /> : null}
            <ProfileNavMenuLink item={block.item} onNavigate={onNavigate} emphasis={block.emphasis} />
          </div>
        );
      })}
    </nav>
  );
}

export function PlatformHeader() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const tHeader = useTranslations("header");
  const tCommon = useTranslations("common");
  const patientNavMenu = usePatientNavMenu();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [notifications, setNotifications] = useState<HeaderNotifRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  const loadProfileAndNotifs = useCallback(async (userId: string) => {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id,full_name,role")
      .eq("id", userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as ProfileLite);
    } else {
      setProfile(null);
    }

    const [{ data: requestNotifs }, { data: promoNotifs }, { count: requestUnread }, { count: promoUnread }] =
      await Promise.all([
        supabase
          .from("app_notifications")
          .select("id,created_at,title,body,title_ar,body_ar,request_id,read_at,event_type")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("promo_in_app_notifications")
          .select("id,created_at,title,body,reservation_id,read_at,event_type")
          .eq("recipient_id", userId)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("app_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null),
        supabase
          .from("promo_in_app_notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId)
          .is("read_at", null),
      ]);

    const role = (profileData as ProfileLite | null)?.role ?? "patient";
    const merged: HeaderNotifRow[] = [
      ...(Array.isArray(requestNotifs)
        ? requestNotifs.map((n) => {
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
              href: notifDetailHref(role, row.request_id),
              source: "request" as const,
            };
          })
        : []),
      ...(Array.isArray(promoNotifs)
        ? promoNotifs.map((n) => {
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
              href: promoNotifHref(role, row.reservation_id),
              source: "promo" as const,
            };
          })
        : []),
    ]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 12);

    setNotifications(merged);
    setUnreadCount((requestUnread ?? 0) + (promoUnread ?? 0));
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (!n.read_at ? { ...n, read_at: nowIso } : n)));
    setUnreadCount(0);
    const [{ error: reqErr }, { error: promoErr }] = await Promise.all([
      supabase
        .from("app_notifications")
        .update({ read_at: nowIso })
        .eq("recipient_id", userId)
        .is("read_at", null),
      supabase
        .from("promo_in_app_notifications")
        .update({ read_at: nowIso })
        .eq("recipient_id", userId)
        .is("read_at", null),
    ]);
    if (reqErr || promoErr) {
      if (userId) await loadProfileAndNotifs(userId);
    }
  }, [loadProfileAndNotifs, session?.user?.id]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadProfileAndNotifs(data.session.user.id);
      } else {
        setProfile(null);
        setNotifications([]);
        setUnreadCount(0);
      }
      setBooting(false);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadProfileAndNotifs(next.user.id);
      } else {
        setProfile(null);
        setNotifications([]);
        setUnreadCount(0);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadProfileAndNotifs]);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`header-notifs-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadProfileAndNotifs(userId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "promo_in_app_notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          void loadProfileAndNotifs(userId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadProfileAndNotifs, session?.user?.id]);

  useEffect(() => {
    if (!profileOpen && !notifOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [profileOpen, notifOpen]);

  const handleLogout = async () => {
    setProfileOpen(false);
    await supabase.auth.signOut();
    router.refresh();
    router.push("/");
  };

  const role = profile?.role ?? "patient";
  const unread = unreadCount;
  const showNotifs = Boolean(session);
  const showLocaleSwitcher = !session || role === "patient";

  return (
    <>
      <LocaleRoleGuard role={profile?.role ?? null} booting={booting} />
    <header
      data-proxipharma-platform-header
      dir="ltr"
      className="fixed inset-x-0 top-0 z-50 border-b border-border/90 bg-card/95 text-foreground shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/90"
    >
      <div className="mx-auto flex h-[3.25rem] max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:h-14 sm:gap-3 sm:px-5">
        <Link
          href="/"
          className="group flex min-w-0 shrink items-center gap-2 text-lg font-bold tracking-tight text-foreground"
          aria-label="Pharmeto"
        >
          <span className="flex min-w-0 items-center gap-2 overflow-hidden sm:hidden">
            <PharmetoLogo
              variant="icon"
              height={34}
              decorative
              className="transition group-hover:opacity-90"
              priority
            />
            <PharmetoLogo
              variant="wordmark"
              height={34}
              className="truncate transition group-hover:opacity-90"
            />
          </span>
          <PharmetoLogo
            variant="lockup"
            height={40}
            className="hidden w-auto transition group-hover:opacity-90 sm:block"
            priority
          />
        </Link>

        <div ref={wrapRef} className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
          {booting ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <LocaleSwitcher visible={showLocaleSwitcher} />
              {showNotifs ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !notifOpen;
                      setNotifOpen(next);
                      setProfileOpen(false);
                      if (next) {
                        void markNotificationsAsRead();
                      }
                    }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted/50"
                    aria-label={tHeader("notifications.ariaLabel")}
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                  {notifOpen ? (
                    <div className="fixed inset-x-3 top-14 z-50 max-h-[min(85vh,28rem)] overflow-hidden rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-xl sm:absolute sm:inset-x-auto sm:end-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[min(100vw-2rem,24rem)]">
                      <div className="border-b border-border/80 px-3 pb-2">
                        <p className="text-xs font-semibold text-foreground">{tHeader("notifications.title")}</p>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">{tHeader("notifications.empty")}</p>
                      ) : (
                        <ul className="max-h-[min(70vh,22rem)] space-y-2 overflow-y-auto px-2 py-2">
                          {notifications.map((n) => {
                            const patientText =
                              role === "patient"
                                ? pickPatientNotificationText(n, locale, "patient")
                                : null;
                            return (
                            <li key={n.id}>
                              <InAppNotificationItem
                                title={
                                  patientText
                                    ? patientText.title
                                    : role === "pharmacien"
                                      ? rewriteForPharmacistView(n.title) ?? n.title
                                      : n.title
                                }
                                body={
                                  patientText
                                    ? patientText.body
                                    : role === "pharmacien"
                                      ? rewriteForPharmacistView(n.body)
                                      : n.body
                                }
                                createdAt={n.created_at}
                                eventType={n.event_type}
                                href={n.href}
                                onNavigate={() => setNotifOpen(false)}
                                compact
                                isRead={Boolean(n.read_at)}
                              />
                            </li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="border-t border-border/80 px-3 pt-2">
                        <Link
                          href="/dashboard/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="block text-center text-xs font-semibold text-primary hover:underline"
                        >
                          {tHeader("notifications.viewAll")}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted/80"
                  aria-label={tHeader("account.ariaLabel")}
                >
                  {session ? (
                    <span className="flex h-full w-full items-center justify-center bg-primary/15 text-xs font-bold text-primary">
                      {initials(profile?.full_name)}
                    </span>
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>

                {profileOpen ? (
                  <div className="absolute end-0 z-50 mt-2 w-[min(100vw-2rem,19.5rem)] rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-xl sm:w-[20.5rem]">
                    {!session ? (
                      <div className="px-2">
                        <Link
                          href="/auth?mode=signup"
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          {tHeader("guest.signup")}
                        </Link>
                        <Link
                          href="/auth"
                          onClick={() => setProfileOpen(false)}
                          className="mt-0.5 block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80"
                        >
                          {tHeader("guest.login")}
                        </Link>
                      </div>
                    ) : profile?.role === "admin" ? (
                      <div className="px-2">
                        <p className="truncate px-3 py-1 text-xs text-muted-foreground">
                          {profile.full_name?.trim() || "Administrateur"}
                        </p>
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                        >
                          Administration
                        </Link>
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          Déconnexion
                        </button>
                      </div>
                    ) : profile?.role === "pharmacien" ? (
                      <div className="flex max-h-[min(70vh,26rem)] flex-col overflow-hidden">
                        <p className="shrink-0 truncate px-5 py-1.5 text-xs text-muted-foreground">
                          {profile.full_name?.trim() || "Pharmacien"}
                        </p>
                        <ProfileNavScrollPanel maxHeightClass="max-h-[min(58vh,20rem)]" scrollHint={tHeader("scrollHint")}>
                          <ProfileNavMenu
                            blocks={pharmacienNavMenu}
                            onNavigate={() => setProfileOpen(false)}
                          />
                        </ProfileNavScrollPanel>
                        <ProfileNavLogoutButton onLogout={() => void handleLogout()} label={tCommon("logout")} />
                      </div>
                    ) : (
                      <div className="flex max-h-[min(70vh,24rem)] flex-col overflow-hidden">
                        <p className="shrink-0 truncate px-5 py-1.5 text-xs text-muted-foreground">
                          {profile?.full_name?.trim() || tHeader("account.patientFallback")}
                        </p>
                        <ProfileNavScrollPanel maxHeightClass="max-h-[min(52vh,18rem)]" scrollHint={tHeader("scrollHint")}>
                          <ProfileNavMenu blocks={patientNavMenu} onNavigate={() => setProfileOpen(false)} />
                        </ProfileNavScrollPanel>
                        <ProfileNavLogoutButton onLogout={() => void handleLogout()} label={tCommon("logout")} />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
    </>
  );
}
