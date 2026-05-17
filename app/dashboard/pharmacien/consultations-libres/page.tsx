import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PharmacistRequestKindHub } from "@/app/dashboard/pharmacien/demandes/pharmacist-demandes-hub";

export default function PharmacienConsultationsLibresPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PharmacistRequestKindHub kindId="free_consultation" />
    </Suspense>
  );
}
