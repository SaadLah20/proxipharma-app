import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PatientPromoReservationsHub } from "@/components/promo/patient-promo-reservations-hub";

export default function PatientPacksPromoPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-3xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PatientPromoReservationsHub />
    </Suspense>
  );
}
