import { Suspense } from "react";
import { PatientHubLoadingFallback } from "@/components/patient/patient-hub-loading-fallback";
import { PatientDemandesHub } from "./patient-demandes-hub";

export default function PatientDemandesPage() {
  return (
    <Suspense fallback={<PatientHubLoadingFallback />}>
      <PatientDemandesHub />
    </Suspense>
  );
}
