"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, User } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { InAppNotificationItem } from "@/components/notifications/in-app-notification-item";
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
      .order("created_at", { ascending: false })
      .limit(12);

    setNotifications(Array.isArray(notifData) ? (notifData as NotifRow[]) : []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadProfileAndNotifs(data.session.user.id);
      } else {
        setProfile(null);
        setNotifications([]);
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
  const unread = notifications.filter((n) => !n.read_at).length;
  const showNotifs = Boolean(session);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/80 bg-white/95 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight text-blue-900">
          ProxiPharma
        </Link>

        <div ref={wrapRef} className="relative flex items-center gap-2">
          {booting ? (
            <div className="h-9 w-9 animate-pulse rounded-full bg-gray-200" />
          ) : (
            <>
              {showNotifs ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen((v) => !v);
                      setProfileOpen(false);
                    }}
                    className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unread > 0 ? (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    ) : null}
                  </button>
                  {notifOpen ? (
                    <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,24rem)] rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
                      <div className="border-b border-gray-100 px-3 pb-2">
                        <p className="text-xs font-semibold text-gray-900">Notifications</p>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-gray-500">Aucune notification récente.</p>
                      ) : (
                        <ul className="max-h-[min(70vh,22rem)] space-y-2 overflow-y-auto px-2 py-2">
                          {notifications.map((n) => (
                            <li key={n.id}>
                              <InAppNotificationItem
                                title={n.title}
                                body={n.body}
                                createdAt={n.created_at}
                                eventType={n.event_type}
                                href={notifDetailHref(role, n.request_id)}
                                onNavigate={() => setNotifOpen(false)}
                                compact
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="border-t border-gray-100 px-3 pt-2">
                        <Link
                          href="/dashboard/notifications"
                          onClick={() => setNotifOpen(false)}
                          className="block text-center text-xs font-medium text-blue-700 hover:underline"
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
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                  aria-label="Compte"
                >
                  {session ? (
                    <span className="flex h-full w-full items-center justify-center bg-blue-100 text-xs font-bold text-blue-900">
                      {initials(profile?.full_name)}
                    </span>
                  ) : (
                    <User className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {profileOpen ? (
                  <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-xl border border-gray-200 bg-white py-2 shadow-xl">
                    {!session ? (
                      <div className="px-2">
                        <Link
                          href="/auth?mode=signup"
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-blue-900 hover:bg-blue-50"
                        >
                          Créer un compte
                        </Link>
                        <Link
                          href="/auth"
                          onClick={() => setProfileOpen(false)}
                          className="mt-0.5 block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                        >
                          Se connecter
                        </Link>
                      </div>
                    ) : profile?.role === "admin" ? (
                      <div className="px-2">
                        <p className="truncate px-3 py-1 text-xs text-gray-500">
                          {profile.full_name?.trim() || "Administrateur"}
                        </p>
                        <Link
                          href="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
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
                      <div className="max-h-[min(70vh,24rem)] overflow-y-auto px-2">
                        <p className="truncate px-3 py-1 text-xs text-gray-500">
                          {profile.full_name?.trim() || "Pharmacien"}
                        </p>
                        {pharmacienNavLinks.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setProfileOpen(false)}
                            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                          >
                            {item.label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          Déconnexion
                        </button>
                      </div>
                    ) : (
                      <div className="max-h-[min(70vh,22rem)] overflow-y-auto px-2">
                        <p className="truncate px-3 py-1 text-xs text-gray-500">
                          {profile?.full_name?.trim() || "Patient"}
                        </p>
                        {patientNavLinks.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setProfileOpen(false)}
                            className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
                          >
                            {item.label}
                          </Link>
                        ))}
                        <button
                          type="button"
                          onClick={() => void handleLogout()}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
                        >
                          <LogOut className="h-4 w-4 shrink-0" />
                          Déconnexion
                        </button>
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
