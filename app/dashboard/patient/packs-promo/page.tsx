import { Suspense } from "react";
import { PatientHubLoadingFallback } from "@/components/patient/patient-hub-loading-fallback";
import { PatientPromoReservationsHub } from "@/components/promo/patient-promo-reservations-hub";

export default function PatientPacksPromoPage() {
  return (
    <Suspense fallback={<PatientHubLoadingFallback />}>
      <PatientPromoReservationsHub />
    </Suspense>
  );
}
