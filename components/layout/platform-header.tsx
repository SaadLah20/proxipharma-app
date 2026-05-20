"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Cross, LogOut, User } from "lucide-react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
import { rewriteForPatientView, rewriteForPharmacistView } from "@/lib/patient-copy";
import { supabase } from "@/lib/supabase";

type ProfileLite = {
  id: string;
  full_name: string | null;
  role: "patient" | "pharmacien" | "admin";
};

type NotifRow = {
  id: string;
  created_at: string;
  title: string;
  body: string | null;
  request_id: string;
  read_at: string | null;
  event_type: string | null;
};

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
}: {
  children: ReactNode;
  maxHeightClass?: string;
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
            Faire défiler
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ProfileNavLogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="shrink-0 border-t border-border/80 bg-popover px-2 py-1.5">
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Déconnexion
      </button>
    </div>
  );
}

export const patientNavLinks: { href: string; label: string }[] = [
  { href: "/dashboard/patient/pharmacies", label: "Mes pharmacies" },
  { href: "/dashboard/demandes", label: "Mes demandes de produits" },
  { href: "/dashboard/patient/ordonnances", label: "Mes ordonnances" },
  { href: "/dashboard/patient/consultations-libres", label: "Mes consultations libres" },
  { href: "/dashboard/patient/liste-souhaits", label: "Liste de souhaits" },
  { href: "/dashboard/patient/parametres", label: "Paramètres" },
];

export const pharmacienNavLinks: { href: string; label: string }[] = [
  { href: "/dashboard/pharmacien", label: "Tableau de bord" },
  { href: "/dashboard/pharmacien/demandes", label: "Demandes de produits" },
  { href: "/dashboard/pharmacien/ordonnances", label: "Ordonnances" },
  { href: "/dashboard/pharmacien/consultations-libres", label: "Consultations libres" },
  { href: "/dashboard/pharmacien/clients", label: "Clients" },
  { href: "/dashboard/pharmacien/produits-commandes", label: "Produits commandés" },
  { href: "/dashboard/pharmacien/ma-fiche", label: "Ma fiche pharmacie" },
  { href: "/dashboard/pharmacien/horaires-garde", label: "Horaires et garde" },
  { href: "/dashboard/pharmacien/visites-interactions", label: "Visites et interactions" },
  { href: "/dashboard/pharmacien/pricing", label: "Moteur de pricing" },
  { href: "/dashboard/pharmacien/ruptures-marche", label: "Produits en rupture" },
  { href: "/dashboard/pharmacien/offres-promos", label: "Offres et promos" },
  { href: "/dashboard/pharmacien/parametres", label: "Paramètres généraux" },
];

export function PlatformHeader() {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
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

    const { data: notifData } = await supabase
      .from("app_notifications")
      .select("id,created_at,title,body,request_id,read_at,event_type")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(12);

    setNotifications(Array.isArray(notifData) ? (notifData as NotifRow[]) : []);

    const { count } = await supabase
      .from("app_notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    setUnreadCount(count ?? 0);
  }, []);

  const markNotificationsAsRead = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (!n.read_at ? { ...n, read_at: nowIso } : n)));
    setUnreadCount(0);
    const { error } = await supabase
      .from("app_notifications")
      .update({ read_at: nowIso })
      .eq("recipient_id", userId)
      .is("read_at", null);
    if (error) {
      // Re-sync from source of truth if update fails.
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

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-800/90 bg-slate-900 text-slate-100 shadow-md">
      <div className="mx-auto flex h-[3.25rem] max-w-6xl items-center justify-between gap-3 px-4 sm:h-14 sm:px-5">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight text-white"
        >
          <span
            className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-sky-200 ring-1 ring-white/15 transition group-hover:bg-white/15"
            aria-hidden
          >
            <Cross className="size-[1.125rem]" strokeWidth={2.25} />
          </span>
          <span>ProxiPharma</span>
        </Link>

        <div ref={wrapRef} className="relative flex items-center gap-2">
          {booting ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
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
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread}
                      </span>
                    ) : null}
                  </button>
                  {notifOpen ? (
                    <div className="fixed inset-x-3 top-14 z-50 max-h-[min(85vh,28rem)] overflow-hidden rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:max-h-none sm:w-[min(100vw-2rem,24rem)]">
                      <div className="border-b border-border/80 px-3 pb-2">
                        <p className="text-xs font-semibold text-foreground">Notifications</p>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">Aucune notification récente.</p>
                      ) : (
                        <ul className="max-h-[min(70vh,22rem)] space-y-2 overflow-y-auto px-2 py-2">
                          {notifications.map((n) => (
                            <li key={n.id}>
                              <InAppNotificationItem
                                title={
                                  role === "patient"
                                    ? rewriteForPatientView(n.title) ?? n.title
                                    : role === "pharmacien"
                                      ? rewriteForPharmacistView(n.title) ?? n.title
                                      : n.title
                                }
                                body={
                                  role === "patient"
                                    ? rewriteForPatientView(n.body)
                                    : role === "pharmacien"
                                      ? rewriteForPharmacistView(n.body)
                                      : n.body
                                }
                                createdAt={n.created_at}
                                eventType={n.event_type}
                                href={notifDetailHref(role, n.request_id)}
                                onNavigate={() => setNotifOpen(false)}
                                compact
                                isRead={Boolean(n.read_at)}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="border-t border-border/80 px-3 pt-2">
                        <Link
                          href="/dashboard/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="block text-center text-xs font-semibold text-primary hover:underline"
                        >
                          Tout voir
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
                  aria-label="Compte"
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
                  <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-border bg-popover py-2 text-popover-foreground shadow-xl">
                    {!session ? (
                      <div className="px-2">
                        <Link
                          href="/auth?mode=signup"
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10"
                        >
                          Créer un compte
                        </Link>
                        <Link
                          href="/auth"
                          onClick={() => setProfileOpen(false)}
                          className="mt-0.5 block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/80"
                        >
                          Se connecter
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
                        <ProfileNavScrollPanel maxHeightClass="max-h-[min(58vh,20rem)]">
                          <div className="px-2 pb-1">
                            {pharmacienNavLinks.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setProfileOpen(false)}
                                className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </ProfileNavScrollPanel>
                        <ProfileNavLogoutButton onLogout={() => void handleLogout()} />
                      </div>
                    ) : (
                      <div className="flex max-h-[min(70vh,24rem)] flex-col overflow-hidden">
                        <p className="shrink-0 truncate px-5 py-1.5 text-xs text-muted-foreground">
                          {profile?.full_name?.trim() || "Patient"}
                        </p>
                        <ProfileNavScrollPanel maxHeightClass="max-h-[min(52vh,18rem)]">
                          <div className="px-2 pb-1">
                            {patientNavLinks.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setProfileOpen(false)}
                                className="block rounded-lg px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </ProfileNavScrollPanel>
                        <ProfileNavLogoutButton onLogout={() => void handleLogout()} />
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
  );
}
