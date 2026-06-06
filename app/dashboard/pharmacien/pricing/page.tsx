"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PharmacistAccountPageHeader } from "@/components/pharmacist/pharmacist-account-page-header";
import { PageShell } from "@/components/ui/compact-shell";
import { PharmacistPricingManager } from "@/components/pharmacist/pricing/pharmacist-pricing-manager";
import { supabase } from "@/lib/supabase";

export default function PharmacienPricingPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const run = async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session?.user) {
        router.replace("/auth?redirect=/dashboard/pharmacien/pricing");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", auth.session.user.id)
        .maybeSingle();
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
      <PharmacistAccountPageHeader
        eyebrow="Officine & visibilité"
        title="Moteur de pricing"
        subtitle="Grille parapharmacie (PPH ± marge), règles par marque ou par produit. Médicaments : PPV catalogue fixe."
      />
      <PharmacistPricingManager />
    </PageShell>
  );
}
