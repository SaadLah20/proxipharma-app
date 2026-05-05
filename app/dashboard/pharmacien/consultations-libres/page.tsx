"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/compact-shell";
import { supabase } from "@/lib/supabase";

export default function PharmacienConsultationsLibresPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/consultations-libres");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.session.user.id).maybeSingle();
      if ((profile as { role?: string } | null)?.role !== "pharmacien") {
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
        <Link href="/dashboard/pharmacien" className="text-xs font-medium text-emerald-900 underline">
          ← Tableau de bord
        </Link>
        <h1 className="mt-2 text-lg font-bold text-foreground">Consultations libres</h1>
        <p className="text-xs text-muted-foreground">
          Demandes de conseil sans ordonnance reçues pour votre officine (à venir).
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-sky-200 bg-sky-50/50 p-6 text-sm text-sky-950">
        Le flux métier et les écrans seront branchés sur le type de demande « consultation libre », comme côté patient.
      </div>
      <Link href="/dashboard/pharmacien/demandes" className="inline-block text-sm font-medium text-emerald-800 underline">
        Demandes de produits
      </Link>
    </PageShell>
  );
}
