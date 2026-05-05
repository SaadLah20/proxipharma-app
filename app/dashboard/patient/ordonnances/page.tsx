"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

export default function PatientOrdonnancesPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/patient/ordonnances");
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
    <PageShell className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Mes ordonnances</h1>
        <p className="text-xs text-muted-foreground">Historique et envoi d’ordonnances (à venir).</p>
      </div>
      <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-6 text-sm text-amber-950">
        Cette section sera branchée sur le stockage sécurisé des ordonnances et le partage avec votre pharmacie.
        Pour l’instant, utilisez les demandes produits pour transmettre vos besoins.
      </div>
      <Link href="/dashboard/demandes" className="inline-block text-sm font-medium text-sky-700 underline">
        Mes demandes de produits
      </Link>
    </PageShell>
  );
}
