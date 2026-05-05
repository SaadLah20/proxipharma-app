"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
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
    <PageShell className="space-y-4">
      <div>
        <Link href="/" className="text-xs font-medium text-sky-800 underline">
          ← Annuaire
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Liste de souhaits</h1>
        <p className="text-xs text-muted-foreground">Produits à suivre ou à commander plus tard (à venir).</p>
      </div>
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        Vous pourrez enregistrer ici des produits favoris ou à rappeler. Aucune donnée n’est encore reliée à cette vue.
      </div>
      <Link href="/" className="inline-block text-sm font-medium text-sky-700 underline">
        Parcourir les pharmacies
      </Link>
    </PageShell>
  );
}
