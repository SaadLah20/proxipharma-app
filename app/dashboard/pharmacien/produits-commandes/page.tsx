"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

export default function PharmacienProduitsCommandesPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/produits-commandes");
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
        <h1 className="mt-2 text-lg font-bold text-foreground">Produits commandés</h1>
        <p className="text-xs text-muted-foreground">Suivi des commandes fournisseurs (à venir).</p>
      </div>
      <div className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-6 text-sm text-emerald-950">
        Cette vue regroupera les lignes confirmées et les bons de commande. En attendant, consultez les demandes patients
        pour les préparations en cours.
      </div>
      <Link href="/dashboard/pharmacien/demandes" className="inline-block text-sm font-medium text-emerald-800 underline">
        Ouvrir les demandes
      </Link>
    </PageShell>
  );
}
