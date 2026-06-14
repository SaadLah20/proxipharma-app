"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clsx } from "clsx";
import { AdminSectionNav } from "@/components/admin/admin-section-nav";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "/admin";
  const maxWidthClass = pathname.startsWith("/admin/produits-communautaires") ? "max-w-6xl" : "max-w-4xl";
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: authData } = await supabase.auth.getSession();
      const user = authData.session?.user;
      if (!user) {
        router.replace("/auth?redirect=/admin");
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if ((profile as { role?: string } | null)?.role !== "admin") {
        router.replace("/");
        return;
      }

      setAuthorized(true);
      setReady(true);
    };

    void init();
  }, [router]);

  if (!ready) {
    return (
      <div className={clsx("mx-auto w-full px-3 py-6 sm:px-5", maxWidthClass)}>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return (
    <div className={clsx("mx-auto w-full space-y-4 px-3 pb-8 pt-1 sm:px-5", maxWidthClass)}>
      <AdminSectionNav />
      {children}
    </div>
  );
}
