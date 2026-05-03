import { Suspense } from "react";
import { PatientDemandesHub } from "./patient-demandes-hub";

export default function PatientDemandesPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen max-w-2xl p-6">
          <p className="text-slate-600">Chargement…</p>
        </main>
      }
    >
      <PatientDemandesHub />
    </Suspense>
  );
}
