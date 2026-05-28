"use client";

import { PatientPharmacyDetail } from "@/components/patient/patient-pharmacy-detail";
import { use } from "react";

export default function PatientPharmacyDetailPage({
  params,
}: {
  params: Promise<{ pharmacyId: string }>;
}) {
  const { pharmacyId } = use(params);
  return <PatientPharmacyDetail pharmacyId={pharmacyId} />;
}
