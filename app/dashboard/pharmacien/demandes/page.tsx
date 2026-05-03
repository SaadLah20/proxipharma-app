import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PharmacistDemandesHub } from "./pharmacist-demandes-hub";

export default function PharmacienDemandesListePage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PharmacistDemandesHub />
    </Suspense>
  );
}
