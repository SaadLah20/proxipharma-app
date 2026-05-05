"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

/** Point d’entrée historique `/dashboard` : renvoie selon le rôle (plus de « Mon espace » unique). */
export default function DashboardEntryRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
      const role = (profile as { role?: string } | null)?.role;
      if (role === "patient") {
        router.replace("/");
      } else if (role === "pharmacien") {
        router.replace("/dashboard/pharmacien");
      } else if (role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/");
      }
    };
    const tid = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(tid);
  }, [router]);

  return (
    <PageShell>
      <p className="text-sm text-muted-foreground">Redirection…</p>
    </PageShell>
  );
}
