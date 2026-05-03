import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PatientDemandesHub } from "./patient-demandes-hub";

export default function PatientDemandesPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PatientDemandesHub />
    </Suspense>
  );
}
