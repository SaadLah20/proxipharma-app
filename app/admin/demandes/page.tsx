"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminAccountPageHeader } from "@/components/admin/admin-account-page-header";
import { AdminPilotBlock } from "@/components/admin/AdminPilotBlock";
import { PHARMACIST_DASHBOARD_BUCKETS, bucketForStatusParam } from "@/lib/demandes-hub-buckets";
import { supabase } from "@/lib/supabase";

type Pharmacy = { id: string; nom: string; ville: string };

function AdminDemandesContent() {
  const searchParams = useSearchParams();
  const statutParam = searchParams.get("statut");
  const bucket = bucketForStatusParam(statutParam, PHARMACIST_DASHBOARD_BUCKETS);
  const initialStatus = bucket ? null : statutParam;
  const initialBucketKey = bucket?.key ?? null;

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);

  const loadPharmacies = useCallback(async () => {
    const { data } = await supabase.from("pharmacies").select("id,nom,ville").order("nom");
    setPharmacies((data ?? []) as Pharmacy[]);
  }, []);

  useEffect(() => {
    const tid = window.setTimeout(() => void loadPharmacies(), 0);
    return () => window.clearTimeout(tid);
  }, [loadPharmacies]);

  return (
    <div className="space-y-4">
      <AdminAccountPageHeader
        title="Demandes pilote"
        subtitle="Suivi transversal des dossiers patient et file de notifications e-mail."
      />
      <AdminPilotBlock
        pharmacies={pharmacies}
        initialStatusFilter={initialStatus}
        initialBucketKey={initialBucketKey ?? statutParam}
      />
    </div>
  );
}

export default function AdminDemandesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Chargement…</p>}>
      <AdminDemandesContent />
    </Suspense>
  );
}
