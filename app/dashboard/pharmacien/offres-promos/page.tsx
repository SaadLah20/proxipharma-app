"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

export default function PharmacienOffresPromosPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/offres-promos");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
      if ((profile as { role?: string } | null)?.role !== "pharmacien") {
        router.replace("/dashboard/pharmacien");
        return;
      }
      setOk(true);
    };
    const tid = window.setTimeout(() => void run(), 0);
    return () => window.clearTimeout(tid);
  }, [router]);

  if (!ok) {
    return (
      <PageShell maxWidthClass="max-w-4xl">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidthClass="max-w-4xl" className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Offres et promos</h1>
        <p className="text-xs text-muted-foreground">Campagnes et affichage côté patients (à venir).</p>
      </div>
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-950">
        Gestion des promotions liées à l’annuaire ou aux demandes — modèle de données à définir.
      </div>
      <Link href="/dashboard/pharmacien/ma-fiche" className="inline-block text-sm font-medium text-emerald-800 underline">
        Ma fiche pharmacie
      </Link>
    </PageShell>
  );
}
