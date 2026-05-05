"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

export default function PatientConsultationsLibresPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/patient/consultations-libres");
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
        <h1 className="mt-2 text-lg font-bold text-foreground">Mes consultations libres</h1>
        <p className="text-xs text-muted-foreground">Demandes de conseil sans ordonnance (à venir).</p>
      </div>
      <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/50 p-6 text-sm text-sky-950">
        Ce module permettra d’initier une consultation informelle avec une pharmacie. Le flux métier et les écrans seront
        branchés sur le type de demande « consultation libre ».
      </div>
      <Link href="/dashboard/demandes" className="inline-block text-sm font-medium text-sky-700 underline">
        Mes demandes de produits
      </Link>
    </PageShell>
  );
}
