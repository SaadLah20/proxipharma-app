"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PatientAccountPageHeader } from "@/components/patient/patient-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { platformDashboardChrome as p } from "@/lib/platform-dashboard-chrome";
import { supabase } from "@/lib/supabase";

export default function PatientListeSouhaitsPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/patient/liste-souhaits");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
      if ((profile as { role?: string } | null)?.role !== "patient") {
        router.replace("/");
        return;
      }
      setOk(true);
    };
    const tid = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(tid);
  }, [router]);

  if (!ok) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-lg" className={p.page}>
      <PatientAccountPageHeader
        eyebrow="Espace patient"
        title="Liste de souhaits"
        subtitle="Produits à suivre ou à commander plus tard (fonctionnalité à venir)."
      />
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
        Vous pourrez enregistrer ici des produits favoris ou à rappeler. Aucune donnée n’est encore reliée à cette vue.
      </div>
      <Link href="/" className={p.linkInline}>
        Parcourir les pharmacies
      </Link>
    </PageShell>
  );
}
