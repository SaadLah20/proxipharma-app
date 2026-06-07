"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { shouldHideBottomNav } from "@/lib/platform-bottom-nav";
import { supabase } from "@/lib/supabase";

type ProfileRole = "patient" | "pharmacien" | "admin" | null;

export function usePlatformBottomNavVisible(): boolean {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<ProfileRole>(null);
  const [booting, setBooting] = useState(true);

  const loadRole = useCallback(async (userId: string) => {
    const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    setRole((data as { role?: ProfileRole } | null)?.role ?? null);
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

  if (booting) return false;
  return !shouldHideBottomNav(pathname, role, Boolean(session));
}
