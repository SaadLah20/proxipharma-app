import { Suspense } from "react";
import { PageShell } from "@/components/ui/compact-shell";
import { PharmacistPromoReservationsHub } from "@/components/promo/pharmacist-promo-reservations-hub";

export default function PharmacienReservationsPacksPage() {
  return (
    <Suspense
      fallback={
        <PageShell maxWidthClass="max-w-4xl">
          <p className="text-muted-foreground">Chargement…</p>
        </PageShell>
      }
    >
      <PharmacistPromoReservationsHub />
    </Suspense>
  );
}
