import { Suspense } from "react";
import { PatientHubLoadingFallback } from "@/components/patient/patient-hub-loading-fallback";
import { PatientRequestKindHub } from "@/app/dashboard/demandes/patient-demandes-hub";

export default function PatientConsultationsLibresPage() {
  return (
    <Suspense fallback={<PatientHubLoadingFallback />}>
      <PatientRequestKindHub kindId="free_consultation" />
    </Suspense>
  );
}
