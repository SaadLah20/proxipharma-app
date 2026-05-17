import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PatientRequestKindHub } from "@/app/dashboard/demandes/patient-demandes-hub";

export default function PatientConsultationsLibresPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PatientRequestKindHub kindId="free_consultation" />
    </Suspense>
  );
}
