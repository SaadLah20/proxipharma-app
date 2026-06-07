"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";
import { useBottomNavDossierTab } from "@/lib/platform-bottom-nav-dossier-tab";
import {
  bottomNavTabsForRole,
  isBottomNavTabActive,
  shouldHideBottomNav,
  type BottomNavRole,
} from "@/lib/platform-bottom-nav";
import { STICKY_FOOTER_SAFE_BOTTOM } from "@/lib/platform-sticky-footer";
import { supabase } from "@/lib/supabase";

type ProfileRole = "patient" | "pharmacien" | "admin" | null;

export function PlatformBottomNav() {
  const pathname = usePathname();
  const t = useTranslations("header.bottomNav");
  const tNav = useTranslations("header");
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ProfileRole>(null);
  const [booting, setBooting] = useState(true);
  const { dossierTabId } = useBottomNavDossierTab();

  const loadRole = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    const nextRole = (data as { role?: ProfileRole } | null)?.role ?? null;
    setRole(nextRole);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session?.user) {
        await loadRole(data.session.user.id);
      } else {
        setRole(null);
      }
      setBooting(false);
    };

    void init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        void loadRole(next.user.id);
      } else {
        setRole(null);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadRole]);

  if (booting) return null;

  const navRole: BottomNavRole | null =
    role === "patient" || role === "pharmacien" ? role : null;
  if (!navRole || shouldHideBottomNav(pathname, role, Boolean(session))) return null;

  const tabs = bottomNavTabsForRole(navRole);

  return (
    <nav
      data-proxipharma-platform-bottom-nav
      data-bottom-nav
      aria-label={tNav("bottomNavAria")}
      className={clsx(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border/90 bg-card/95 text-foreground shadow-[0_-4px_18px_rgba(15,23,42,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-card/90",
        STICKY_FOOTER_SAFE_BOTTOM
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-stretch justify-around gap-0.5 px-1 sm:px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isBottomNavTabActive(pathname, tab, navRole, dossierTabId);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={clsx(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-semibold leading-tight transition sm:text-[11px]",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={clsx("size-5 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="max-w-full truncate text-center">{t(tab.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
